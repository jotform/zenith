import { DebugJSON } from '../../types/ConfigTypes';
import Zipper from './../Zipper';
import ZipExporter from '../../libs/zipExporter';
import { Readable } from 'stream';
import Logger from '../../utils/logger';
import { configManagerInstance } from '../../config';
import path = require('path');
import { ROOT_PATH } from '../../utils/constants';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { getMissingRequiredFiles, isOutputTxt } from '../../utils/functions';
import unzipper from 'unzipper';
import Hasher from './../Hasher';

export default abstract class Cacher {
  cachePath = '';

  abstract putObject({Bucket, Key, Body}: {Bucket?: string,Key: string, Body: Buffer | string}): Promise<void>
  abstract getObject({Bucket, Key}: {Bucket?: string,Key: string}): Promise<Readable>
  abstract listObjects({Bucket, Prefix}: {Bucket?: string, Prefix: string}): Promise<string[]>
  
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
    return new Promise<void>((resolve, reject) => {
      try {
        const cachePath = `${target}/${hash}/${root}`;
        const directoryPath = path.join(ROOT_PATH, root, !isOutputTxt(output) ? output : '');
        if (!existsSync(directoryPath)) {
          resolve();
          return;
        }
        const outputHash = Hasher.getHash(directoryPath);
        const outputBuff = Buffer.from(outputHash);
        this.putObject(
          {
            Bucket: configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
            Key: `${cachePath}/${output}-hash.txt`,
            Body: outputBuff
          }).then(() => {
            Logger.log(3, 'Hash successfully stored');
            resolve();
          }).catch((err) => {
            Logger.log(2, err);
            reject(err);
          });
      } catch (error) {
        Logger.log(2, error);
      }
    });
  }

  cacheZip(cachePath: string, output: string, directoryPath: string) {
    return new Promise<void>((resolve, reject) => {
      Zipper.zip(directoryPath, (error: Error | null, zipped: ZipExporter) => {
      if (!error) {
          zipped.compress();
          zipped.memory().then((buff) => {
            if (buff instanceof Buffer) {
              this.putObject(
                {
                  Key: `${cachePath}/${output}.zip`,
                  Body: buff
                }).then(() => {
                  Logger.log(3, 'Zip Cache successfully stored');
                  resolve();
                }).catch((err) => {
                  Logger.log(2, err);
                  reject(err);
                });
            }
          }).catch((err) => {
            Logger.log(2, err);
            reject(err);
          });
        } else {
          Logger.log(2, 'ERROR => ', error);
          reject(error);
        }
      });
    });
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

  pipeEnd(stream: Readable, outputPath: string) {
    return new Promise<string>((resolve, reject) => {
      stream
        .pipe(
          unzipper
            .Extract({ path: outputPath })
            .on('close', () => {
              const hash = Hasher.getHash(outputPath);
              resolve(hash);
            })
            .on('error', (unzipperErr: string) => reject(unzipperErr))
        )
        .on('error', (err: string) => reject(err));
    });
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

  async recoverFromCache(originalHash: string, root: string, output: string, target: string, logAffected: boolean): Promise<string | void> {
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
        if (logAffected) return stdout;
        return Logger.log(2, await this.txtPipeEnd(response));
      }
      if (existsSync(outputPath)) {
        rmSync(outputPath, { recursive: true, force: true });
        mkdirSync(outputPath);
      }
      return await this.pipeEnd(response, outputPath);
    } catch (error) {
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
