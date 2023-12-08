import { DebugJSON } from '../../types/ConfigTypes';
import Zipper from './../Zipper';
import { Readable } from 'stream';
import Logger from '../../utils/logger';
import { configManagerInstance } from '../../config';
import path = require('path');
import { ROOT_PATH } from '../../utils/constants';
import { existsSync } from 'fs';
import { stat, rm, mkdir } from 'fs/promises';
import { getMissingRequiredFiles, isOutputTxt, readableToBuffer } from '../../utils/functions';
import Hasher from './../Hasher';
import { NodeSystemError } from '../../types/BuildTypes';

export default abstract class Cacher {
  cachePath = '';

  abstract putObject({Bucket, Key, Body}: {Bucket?: string,Key: string, Body: Buffer | string}): Promise<void>
  abstract getObject({Bucket, Key}: {Bucket?: string,Key: string}): Promise<Readable>
  abstract listObjects({Bucket, Prefix}: {Bucket?: string, Prefix: string}): Promise<string[]>

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

  async sendOutputHash(hash: string, root: string, output: string, target: string): Promise<void> {
    if (configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) return;
    try {
      const cachePath = `${target}/${hash}/${root}`;
      const directoryPath = path.join(ROOT_PATH, root, !isOutputTxt(output) ? output : '');
      const outputHash = Hasher.getHash(directoryPath);
      const outputBuff = Buffer.from(outputHash);
      await this.putObject({
        Bucket: configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
        Key: `${cachePath}/${output}-hash.txt`,
        Body: outputBuff
      });
      Logger.log(3, 'Hash successfully stored');
    } catch (error) {
      if (error instanceof Error) throw error;
      if (typeof error === 'string') throw new Error(error);
      Logger.log(2, error);
      throw new Error();
    }
  }

  async cacheZip(cachePath: string, output: string, directoryPath: string) {
    const zipped = await Zipper.zip(directoryPath);
    zipped.compress();
    const buff = await zipped.memory();
    if (buff instanceof Buffer) {
      await this.putObject({
        Key: `${cachePath}/${output}.zip`,
        Body: buff
      });
      Logger.log(3, 'Zip Cache successfully stored');
    } else {
      Logger.log(2, 'Zip Cache failed to store');
      throw new Error('Zip Cache failed to store');
    }
  }

  async cacheTxt(cachePath: string, output: string, commandOutput: string) {
    try {
      await this.putObject({
        Key: `${cachePath}/${output}.txt`,
        Body: commandOutput
      });
      Logger.log(3, 'Txt Cache successfully stored');
    } catch (error) {
      Logger.log(2, error);
    }
  }

  async cache(hash: string, root: string, output: string, target: string, commandOutput: string, requiredFiles: string[] | undefined) {
    if (configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) return;
    try {
      const directoryPath = path.join(ROOT_PATH, root, output);
      if ((output !== 'stdout' && !existsSync(directoryPath))) {
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
    try {
      const buff = await readableToBuffer(stream);
      const unzipped = await Zipper.unzip(buff);
      await unzipped.save(outputPath);
      const hash = Hasher.getHash(outputPath);
      return hash;
    } catch (error) {
      Logger.log(2, error);
      throw error;
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
    if (isStdOut && logAffected) {
      Logger.log(3, `${root} => Cached, output is text, and log affected is true. Not recovering from cache.`);
      return '';
    }
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
      if (!error) {
        return false;
      }
      Logger.log(2, error);
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

  async isCached(hash: string, root: string, outputs: Array<string>, target: string) {
    const cachedFolder = await this.listObjects({
      Bucket: configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
      Prefix: `${target}/${hash}/${root}`
    });
    if (cachedFolder) {
      for (const output of outputs) {
        // TODO: find a better, more generalized way for extensions
        const cachePath = `${target}/${hash}/${root}/${output}.${
          isOutputTxt(output) ? 'txt' : 'zip'
        }`;
        if (!cachedFolder.includes(cachePath)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

}
