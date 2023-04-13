import { existsSync, mkdirSync, rmSync } from 'fs';
import * as path from 'path';
import { S3 } from '@aws-sdk/client-s3';
import zipper from 'zip-local';
import unzipper from 'unzipper';
import { Readable } from 'stream';
import { ROOT_PATH } from '../utils/constants';
import { isOutputTxt } from '../utils/functions';
import Logger from '../utils/logger';
import Hasher from './Hasher';
import { DebugJSON } from '../types/ConfigTypes';

class RemoteCacher {
  s3Client: S3;

  constructor() {
    const S3_ACCESS_KEY = typeof process.env.S3_ACCESS_KEY === 'string' ? process.env.S3_ACCESS_KEY : '';
    const S3_SECRET_KEY = typeof process.env.S3_SECRET_KEY === 'string' ? process.env.S3_SECRET_KEY : '';
    this.s3Client = new S3({
      region: 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY
      }
    });
  }

  async getDebugFile(compareWith: string, target: string, debugLocation: string) {
    if (compareWith) {
      const debugFilePath = `${target}/${debugLocation}debug.${compareWith}.json`;
      try {
        const response = await this.s3Client.getObject({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: debugFilePath
        });
        if (response.Body === undefined) throw Error('debug JSON was undefined');
        const debugFileString = await response.Body.transformToString();
        return JSON.parse(debugFileString);
      } catch (error) {
        Logger.log(2, error);
      }
    }
  }

  updateDebugFile(debugJSON: DebugJSON, target: string, debugLocation: string) {
    if (process.env.ZENITH_READ_ONLY) return;
    const debugBuff = Buffer.from(JSON.stringify(debugJSON));
    this.s3Client.putObject(
      {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${target}/${debugLocation}debug.${process.env.ZENITH_DEBUG_ID}.json`,
        Body: debugBuff
      },
      err => {
        if (err) {
          Logger.log(2, err);
        }
        Logger.log(3, 'Cache successfully stored');
      }
    );
  }

  sendOutputHash(hash: string, root: string, output: string, target: string) {
    if (process.env.ZENITH_READ_ONLY) return;
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
        this.s3Client.putObject(
          {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `${cachePath}/${output}-hash.txt`,
            Body: outputBuff
          },
          err => {
            if (err) {
              Logger.log(2, err);
              reject(err);
            }
            Logger.log(3, 'Cache successfully stored');
            resolve();
          }
        );
      } catch (error) {
        Logger.log(2, error);
      }
    });
  }

  cacheZip(cachePath: string, output: string, directoryPath: string) {
    return new Promise<void>((resolve, reject) => {
      zipper.zip(directoryPath, (error, zipped) => {
        if (!error) {
          zipped.compress();
          const buff = zipped.memory();
          this.s3Client.putObject(
            {
              Bucket: process.env.S3_BUCKET_NAME,
              Key: `${cachePath}/${output}.zip`,
              Body: buff
            },
            err => {
              if (err) {
                Logger.log(2, err);
                reject(err);
              }
              Logger.log(3, 'Cache successfully stored');
              resolve();
            }
          );
        } else {
          Logger.log(2, 'ERROR => ', error);
          reject(error);
        }
      });
    });
  }

  cacheTxt(cachePath: string, output: string, commandOutput: string) {
    return new Promise<void>((resolve, reject) => this.s3Client.putObject(
      {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${cachePath}/${output}.txt`,
        Body: commandOutput
      },
      err => {
        if (err) {
          Logger.log(2, err);
          reject(err);
        }
        Logger.log(3, 'Cache successfully stored');
        Logger.log(2, commandOutput);
        resolve();
      }
    ));
  }

  async cache(hash: string, root: string, output: string, target: string, commandOutput: string) {
    if (process.env.ZENITH_READ_ONLY) return;
    try {
      const directoryPath = path.join(ROOT_PATH, root, output);
      if (output !== 'stdout' && !existsSync(directoryPath)) {
        return;
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

  txtPipeEnd(stream: Readable) {
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

  async recoverFromCache(originalHash: string, root: string, output: string, target: string, logAffected: boolean) {
    const isStdOut = isOutputTxt(output);
    const remotePath = `${target}/${originalHash}/${root}/${output}.${isStdOut ? 'txt' : 'zip'}`;
    try {
      const response = await this.s3Client.getObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: remotePath
      });
      const outputPath = path.join(ROOT_PATH, root, output);
      if (response.Body === undefined) throw new Error('Error while recovering from cache: S3 Response Body is undefined');
      const responseBody = response.Body as Readable;
      if (isStdOut) {
        const stdout = await this.txtPipeEnd(responseBody);
        if (logAffected) return stdout;
        return Logger.log(2, await this.txtPipeEnd(responseBody));
      }
      if (existsSync(outputPath)) {
        rmSync(outputPath, { recursive: true, force: true });
        mkdirSync(outputPath);
      }
      return await this.pipeEnd(responseBody, outputPath);
    } catch (error) {
      Logger.log(2, error);
    }
  }

  async checkHashes(hash: string, root: string, output: string, target: string) {
    const remotePath = `${target}/${hash}/${root}/${output}-hash.txt`;
    try {
      const response = await this.s3Client.getObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: remotePath
      });
      if (response.Body === undefined) throw new Error('Error while checking hashes: S3 Response Body is undefined');
      const remoteHash = await response.Body.transformToString();
      return remoteHash;
    } catch (error) {
      Logger.log(2, error);
    }
  }

  async isCached(hash: string, root: string, outputs: Array<string>, target: string) {
    const cachedFolder = await this.s3Client.listObjectsV2({
      Bucket: process.env.S3_BUCKET_NAME,
      Prefix: `${target}/${hash}/${root}`
    });
    if (cachedFolder.Contents) {
      const contents = cachedFolder.Contents.reduce<Record<string, boolean>>((acc, curr) => {
        if (curr.Key === undefined) return acc;
        acc[curr.Key] = true;
        return acc;
      }, {});
      // eslint-disable-next-line no-restricted-syntax
      for (const output of outputs) {
        // TODO: find a better, more generalized way for extensions
        const cachePath = `${target}/${hash}/${root}/${output}.${
          isOutputTxt(output) ? 'txt' : 'zip'
        }`;
        if (!contents[cachePath]) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  updateBuildMap() {
    // this.cacheClient.fPutObject(process.env.S3_BUCKET_NAME, 'buildMap.json', './build.json', (err, data) => {
    //   if (err) {
    //     console.log(err, 'ERROR');
    //   }
    //   console.log('SUCCESS UPDATING BUILD MAP', data);
    // });
  }
}

const RemoteCacherInstance = new RemoteCacher();
export default RemoteCacherInstance;
