import { existsSync, mkdirSync, rmSync } from "fs";
import * as path from "path";
import { S3 } from "@aws-sdk/client-s3";
import zipper from "zip-local";
import unzipper from "unzipper";
import { ROOT_PATH } from "../utils/constants";
import { isOutputTxt } from "../utils/functions";
import Logger from "../utils/logger";
import Hasher from "./Hasher";

class RemoteCacher {
  constructor() {
    this.s3Client = new S3({
      region: "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
    });
  }

  async getDebugFile(compareWith, target) {
    if (compareWith) {
      const debugFilePath = `${target}/debug/debug.${compareWith}.json`;
      try {
        const response = await this.s3Client.getObject({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: debugFilePath,
        });
        const debugFileString = await response.Body.transformToString();
        return JSON.parse(debugFileString);
      } catch (error) {
        Logger.log(2, error);
      }
    }
  }

  updateDebugFile(debugJSON, target) {
    if (process.env.ZENITH_READ_ONLY) return;
    const debugBuff = Buffer.from(JSON.stringify(debugJSON));
    this.s3Client.putObject(
      {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${target}/debug/debug.${process.env.ZENITH_DEBUG_ID}.json`,
        Body: debugBuff,
      },
      (err) => {
        if (err) {
          Logger.log(2, err);
        }
        Logger.log(3, "Cache successfully stored");
      }
    );
  }

  sendOutputHash(hash, root, output, target) {
    if (process.env.ZENITH_READ_ONLY) return;
    return new Promise((resolve) => {
      try {
        const cachePath = `${target}/${hash}/${root}`;
        const directoryPath = path.join(ROOT_PATH, root, !isOutputTxt(output) ? output : '')
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
            Body: outputBuff,
          },
          (err) => {
            if (err) {
              Logger.log(2, err);
              reject(err);
            }
          }
        );
        Logger.log(3, "Cache successfully stored");
        resolve();
      } catch (error) {
        Logger.log(2, error);
      }
    });
  }

  cacheZip(cachePath, output, directoryPath) {
    return new Promise((resolve, reject) => {
      zipper.zip(directoryPath, (error, zipped) => {
        if (!error) {
          zipped.compress();
          const buff = zipped.memory();
          this.s3Client.putObject(
            {
              Bucket: process.env.S3_BUCKET_NAME,
              Key: `${cachePath}/${output}.zip`,
              Body: buff,
            },
            (err) => {
              if (err) {
                Logger.log(2, err);
                reject(err);
              }
              Logger.log(3, "Cache successfully stored");
              resolve();
            }
          );
        } else {
          Logger.log(2, "ERROR => ", error);
          reject(error);
        }
      })
    });
  }

  cacheTxt(cachePath, output, commandOutput) {
    return new Promise((resolve, reject) => this.s3Client.putObject(
      {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${cachePath}/${output}.txt`,
        Body: commandOutput,
      },
      (err) => {
        if (err) {
          Logger.log(2, err);
          reject(err);
        }
        Logger.log(3, "Cache successfully stored");
        Logger.log(2, commandOutput)
        resolve();
      }
    ));
  }

  async cache(hash, root, output, target, commandOutput) {
    if (process.env.ZENITH_READ_ONLY) return;
    try {
      const directoryPath = path.join(ROOT_PATH, root, output);
      if (!existsSync(directoryPath)) {
        mkdirSync(directoryPath);
      }
      const cachePath = `${target}/${hash}/${root}`;
      switch (output) {
        case 'stdout':
          await this.cacheTxt(cachePath, output, commandOutput)
          break
        default:
          await this.cacheZip(cachePath, output, directoryPath)
      }
    } catch (error) {
      Logger.log(2, error);
      throw new Error(error)
    };
  }

  pipeEnd(stream, outputPath) {
    return new Promise((resolve) => {
      stream
        .pipe(
          unzipper
            .Extract({ path: outputPath })
            .on("close", () => {
              const hash = Hasher.getHash(outputPath);
              resolve(hash);
            })
            .on("error", (unzipperErr) => reject(unzipperErr))
        )
        .on("error", (err) => reject(err));
    });
  }
  
  // TODO: dont return hash
  txtPipeEnd(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => {chunks.push(Buffer.from(chunk))});
      stream.on('error', err => reject(err));
      stream.on('end', () => {
        const output = Buffer.concat(chunks).toString('utf8');
        console.log(output)
        resolve(output);
      });
    })
  }

  async recoverFromCache(originalHash, root, output, target) {
    const isStdOut = isOutputTxt(output)
    const remotePath = `${target}/${originalHash}/${root}/${output}.${isStdOut ? 'txt' : 'zip'}`;
    try {
      const response = await this.s3Client.getObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: remotePath,
      });
      const outputPath = path.join(ROOT_PATH, root, output);
      if (isStdOut) return Logger.log(2, await this.txtPipeEnd(response.Body));
      if (existsSync(outputPath)) {
        rmSync(outputPath, { recursive: true, force: true });
        mkdirSync(outputPath);
      }
      return await this.pipeEnd(response.Body, outputPath);
    } catch (error) {
      Logger.log(2, error);
    }
  }

  async checkHashes(hash, root, output, target) {
    const remotePath = `${target}/${hash}/${root}/${output}-hash.txt`;
    try {
      const response = await this.s3Client.getObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: remotePath,
      });
      const remoteHash = await response.Body.transformToString();
      return remoteHash;
    } catch (error) {
      Logger.log(2, error);
    }
  }

  async isCached(hash, root, outputs, target) {
    const cachedFolder = await this.s3Client.listObjectsV2({
      Bucket: process.env.S3_BUCKET_NAME,
      Prefix: `${target}/${hash}/${root}`,
    });
    if (cachedFolder.Contents) {
      const contents = cachedFolder.Contents.reduce((acc, curr) => {
        acc[curr.Key] = true;
        return acc;
      }, {});
      for (const output of outputs) {
        // TODO: find a better, more generalized way for extensions
        const cachePath = `${target}/${hash}/${root}/${output}.${
          isOutputTxt(output) ? "txt" : "zip"
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
