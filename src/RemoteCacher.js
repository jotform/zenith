import { existsSync, mkdirSync, rmSync } from 'fs';
import * as path from 'path';;
import ROOT_PATH from './utils/Constants';
import { S3 } from '@aws-sdk/client-s3';
import zipper from 'zip-local';
import unzipper from 'unzipper';
import Hasher from './Hasher';
export default class RemoteCacher {
  cachedList = new Set();
  constructor() {
    this.s3Client = new S3({
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      }
    });
  }

  async getDebugFile(compareWith) {
    if (compareWith) {
      const debugFilePath = `frontend-build/debug/debug.${compareWith}.json`;
      try {
        const response = await this.s3Client.getObject({ Bucket: process.env.S3_BUCKET_NAME, Key: debugFilePath });
        const debugFileString = await response.Body.transformToString();
        return JSON.parse(debugFileString);
      } catch (error) {
        console.log(error);
      }
    }
  }

  updateDebugFile(debugJSON) {
    if (process.env.ZENITH_READ_ONLY) return;
    const debugBuff = Buffer.from(JSON.stringify(debugJSON));
    this.s3Client.putObject({ Bucket: process.env.S3_BUCKET_NAME, Key: `frontend-build/debug/debug.${process.env.ZENITH_DEBUG_ID}.json`, Body: debugBuff }, err => {
      if (err) {
        console.log(err);
      }
      console.log('Cache successfully stored');
    });
  }

  sendOutputHash(hash, root, output) {
    if (process.env.ZENITH_READ_ONLY) return;
    return new Promise(resolve => {
      try {
        const cachePath = `frontend-build/${hash}/${root}`;
        const directoryPath = path.join(ROOT_PATH, root, output);
        if (!existsSync(directoryPath)) {
          resolve();
          return;
        };
        const outputHash = Hasher.getHash(directoryPath);
        const outputBuff = Buffer.from(outputHash);
        this.s3Client.putObject({ Bucket: process.env.S3_BUCKET_NAME, Key: `${cachePath}/${output}.txt`, Body: outputBuff }, err => {
          if (err) {
            console.log(err);
            reject(err)
          }
          console.log('Cache successfully stored')
          resolve();
        });
      } catch (error) {
        console.log(error);
      }
    })
  }

  cache(hash, root, output) {
    if (process.env.ZENITH_READ_ONLY) return;
    return new Promise((resolve, reject) => {
      try {
        const directoryPath = path.join(ROOT_PATH, root, output);
        if (!existsSync(directoryPath)) {
          resolve();
          return;
        };
        const cachePath = `frontend-build/${hash}/${root}`;
        zipper.zip(directoryPath, (error, zipped) => {
          if (!error) {
            zipped.compress();
            const buff = zipped.memory();
            this.s3Client.putObject({ Bucket: process.env.S3_BUCKET_NAME, Key: `${cachePath}/${output}.zip`, Body: buff }, err => {
              if (err) {
                console.log(err);
                reject(err)
              }
              console.log('Cache successfully stored')
              resolve();
            });
          } else {
            console.log('ERROR => ', error);
          }
        })
      } catch (error) {
        console.log(error);
        reject(error);
      }
    })
  }

  pipeEnd(stream, outputPath) {
    return new Promise(resolve => {
      stream.pipe(unzipper.Extract({ path: outputPath }).on('close', () => {
        const hash = Hasher.getHash(outputPath);
        resolve(hash);
      }).on('error', unzipperErr => reject(unzipperErr))).on('error', err => reject(err));
    })
  }

  async recoverFromCache(hash, root, output) {
    const remotePath = `frontend-build/${hash}/${root}/${output}.zip`;
    try {
      const response = await this.s3Client.getObject({ Bucket: process.env.S3_BUCKET_NAME, Key: remotePath });
      const outputPath = path.join(ROOT_PATH, root, output);
      if (existsSync(outputPath)) {
        rmSync(outputPath, { recursive: true, force: true });
        mkdirSync(outputPath);
      }
      const hash = await this.pipeEnd(response.Body, outputPath);
      return hash;
    } catch (error) {
      console.log(error);
    }
  }

  async checkHashes(hash, root, output) {
    const remotePath = `frontend-build/${hash}/${root}/${output}.txt`;
    try {
      const response = await this.s3Client.getObject({ Bucket: process.env.S3_BUCKET_NAME, Key: remotePath });
      const remoteHash = await response.Body.transformToString();
      return remoteHash;
    } catch (error) {
      console.log(error);
    }
  }

  async isCached(hash, root, outputs) {
    const cachedFolder = await this.s3Client.listObjectsV2({ Bucket: process.env.S3_BUCKET_NAME, Prefix: `frontend-build/${hash}/${root}` });
    if (cachedFolder.Contents) {
      const contents = cachedFolder.Contents.reduce((acc, curr) => {
        acc[curr.Key] = true;
        return acc;
      }, {});
      for (const output of outputs) {
        const cachePath = `frontend-build/${hash}/${root}/${output}.zip`;
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
