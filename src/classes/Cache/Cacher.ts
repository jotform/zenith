import { DebugJSON } from '../../types/ConfigTypes';
import Zipper from './../Zipper';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { pipeline } from 'stream/promises';
import * as fsp from 'fs/promises';
import { Readable } from 'stream';
import extract from 'extract-zip';
import Logger from '../../utils/logger';
import { configManagerInstance } from '../../config';
import path = require('path');
import { ROOT_PATH } from '../../utils/constants';
import { existsSync } from 'fs';
import { stat, rm, mkdir } from 'fs/promises';
import { getMissingRequiredFiles, isOutputTxt } from '../../utils/functions';
import Hasher from './../Hasher';
import { NodeSystemError } from '../../types/BuildTypes';

export default abstract class Cacher {
  cachePath = '';
  hasher = new Hasher();

  abstract putObject({Bucket, Key, Body}: {Bucket?: string, Key: string, Body: Buffer | string | Readable}): Promise<void>
  abstract getObject({Bucket, Key}: {Bucket?: string,Key: string}): Promise<Readable>

  isHybrid() {
    return false;
  }

  isDebug() {
    return process.env.ZENITH_CACHE_DEBUG === 'true';
  }
  
  callback({
    successMessage,
    resolve,
    reject
  } : {
    successMessage: string,
    resolve?: (value: void | PromiseLike<void>) => void,
    reject?: (reason?: unknown) => void
  }) {
    return (err: Error | null) => {
      if (err) {
        Logger.log(2, err);
        if (reject) reject(err);
      }
      Logger.log(3, successMessage);
      if (resolve) resolve();
    };
  }

  abstract getDebugFile(compareWith: string, target: string, debugLocation: string): Promise<Record<string, string>>
  abstract updateDebugFile(debugJSON: DebugJSON, target: string, debugLocation: string): void
  sendOutputHash(hash: string, root: string, output: string, target: string): Promise<void> | undefined {
    if (configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) return;
    return (async () => {
      try {
        const cachePath = `${target}/${hash}/${root}`;
        const directoryPath = path.join(ROOT_PATH, root, !isOutputTxt(output) ? output : '');
        if (!existsSync(directoryPath)) {
          return;
        }
        const outputHash = await this.hasher.getHash(directoryPath);
        const outputBuff = Buffer.from(outputHash);
        await this.putObject({
          Bucket: configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
          Key: `${cachePath}/${output}-hash.txt`,
          Body: outputBuff,
        });
        Logger.log(3, 'Hash successfully stored');
      } catch (error) {
        Logger.log(2, error);
        throw error;
      }
    })();
  }

  async cacheZip(cachePath: string, output: string, directoryPath: string) {
    const zipped = await Zipper.zip(directoryPath);
    zipped.compress();
    const body = zipped.stream();
    await this.putObject({
      Key: `${cachePath}/${output}.zip`,
      Body: body,
    });
    Logger.log(3, 'Zip Cache successfully stored');
  }

  cacheTxt(cachePath: string, output: string, commandOutput: string) {
    return new Promise<void>((resolve, reject) => {
      this.putObject({
        Key: `${cachePath}/${output}.txt`,
        Body: commandOutput
      }).then(() => {
        Logger.log(3, 'Txt Cache successfully stored');
        resolve();
      }).catch((err) => {
        Logger.log(2, err);
        reject(err);
      });
    });
  }

  async cache(hash: string, root: string, output: string, target: string, commandOutput: string, requiredFiles: string[] | undefined) {
    if (configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) return;
    try {
      const directoryPath = path.join(ROOT_PATH, root, output);
      if (output !== 'stdout' && !existsSync(directoryPath)) {
        return;
      }
      const notFoundFiles = getMissingRequiredFiles(directoryPath, requiredFiles);
      if (notFoundFiles.length > 0) {
        const fileLog = notFoundFiles.reduce((acc, curr) => {
          return `${acc}\n${curr}`;
        }, '');
        throw new Error(`Below required files are not found while building ${root}.\n${fileLog}`);
      }
      const cachePath = `${target}/${hash}/${root}`;
      if (this.isDebug()) Logger.log(1, `Caching output ${directoryPath} to ${cachePath}`);
      switch (output) {
        case 'stdout':
          await this.cacheTxt(cachePath, output, commandOutput);
          break;
        default:
          await this.cacheZip(cachePath, output, directoryPath);
      }
    } catch (error) {
      Logger.log(2, error);
      if (error instanceof Error) throw error;
      if (typeof error === 'string') throw new Error(error);
      throw new Error();
    }
  }

  async pipeEnd(stream: Readable, outputPath: string) {
    const tmpRoot = await fsp.mkdtemp(join(tmpdir(), `zenith-unzip-${randomBytes(4).toString('hex')}-`));
    const tmpZip = join(tmpRoot, 'artifact.zip');
    try {
      await pipeline(stream, createWriteStream(tmpZip));
      await extract(tmpZip, { dir: outputPath });
      return await this.hasher.getHash(outputPath);
    } catch (error) {
      Logger.log(2, error);
      throw error;
    } finally {
      await fsp.rm(tmpRoot, { recursive: true, force: true });
    }
  }

  txtPipeEnd(stream: Readable): Promise<string> {
    const chunks: Array<Buffer> = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => { chunks.push(Buffer.from(chunk)); });
      stream.on('error', (err: Error) => reject(err));
      stream.on('end', () => {
        const output = Buffer.concat(chunks).toString('utf8');
        resolve(output);
      });
    });
  }

  async recoverFromCache(originalHash: string, root: string, output: string, target: string, logAffected: boolean): Promise<string | boolean | void> {
    const isStdOut = isOutputTxt(output);
    const remotePath = `${target}/${originalHash}/${root}/${output}.${isStdOut ? 'txt' : 'zip'}`;
    try {
      const response = await this.getObject({
        Bucket: configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
        Key: remotePath
      });
      const outputPath = path.join(ROOT_PATH, root, output);
      if (response === undefined) throw new Error('Error while recovering from cache: S3 Response Body is undefined');
      if (isStdOut) {
        const stdout = await this.txtPipeEnd(response);
        if (!logAffected) Logger.log(2, stdout);
        return stdout;
      }
      try {
        const stats = await stat(outputPath);
        if (stats.isDirectory()) {
          await rm(outputPath, { recursive: true, force: true });
          await mkdir(outputPath);
        }
      } catch (err) {
        const nodeError = err as NodeSystemError;
        if (nodeError.code !== 'ENOENT') {
          Logger.log(2, err);
          throw err;
        }
        await mkdir(outputPath);
      }
      return await this.pipeEnd(response, outputPath);
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (status === 404) {
        return 'Cache not found';
      }
      Logger.log(2, "ERR-C-R ::", error);
      throw error;
    }
  }

  async checkHashes(hash: string, root: string, output: string, target: string): Promise<Readable | undefined> {
    const remotePath = `${target}/${hash}/${root}/${output}-hash.txt`;
    try {
      const response = await this.getObject({
        Bucket: configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
        Key: remotePath
      });
      if (response === undefined) throw new Error('Error while checking hashes: S3 Response Body is undefined');
      return response;
    } catch (error) {
      Logger.log(2, error);
    }
  }

}
