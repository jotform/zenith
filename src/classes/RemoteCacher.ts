import { S3 } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import Logger from '../utils/logger';
import { DebugJSON } from '../types/ConfigTypes';
import { configManagerInstance } from '../config';
import Cacher from './Cacher';

class RemoteCacher extends Cacher {
  s3Client: S3 = undefined as unknown as S3;

  constructor() {
    super();
    const S3_ACCESS_KEY = configManagerInstance.getConfigValue('S3_ACCESS_KEY');
    const S3_SECRET_KEY = configManagerInstance.getConfigValue('S3_SECRET_KEY');
    this.s3Client = new S3({
      region: 'us-east-1',
      endpoint: configManagerInstance.getConfigValue('S3_ENDPOINT'),
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY
      }
    });
  }

  putObject({ Bucket, Key, Body }: { Bucket?: string | undefined, Key: string; Body: string | Buffer }): Promise<void> {
    return new Promise((resolve, reject) => {
      this.s3Client.putObject({
        Bucket: Bucket || configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
        Key,
        Body
      }).then(() => {
        Logger.log(3, 'Cache successfully stored');
        resolve();
      }).catch(err => {
        Logger.log(2, err);
        reject(err);
      });
    });
  }

  getObject({ Bucket, Key }: { Bucket?: string | undefined, Key: string }): Promise<Readable> {
    return new Promise((resolve, reject) => {
      this.s3Client.getObject({
        Bucket: Bucket || configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
        Key
      },
      (err, data) => {
        if (err) {
          Logger.log(2, err);
          reject(err);
        }
        Logger.log(3, 'Cache successfully stored');
        resolve(data?.Body as Readable);
      });
    });
  }

  listObjects({ Bucket, Prefix}: {Bucket?: string, Prefix: string}): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.s3Client.listObjectsV2({
        Bucket: Bucket || configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
        Prefix
      },
      (err, data) => {
        if (err) {
          Logger.log(2, err);
          reject(err);
        }
        resolve(data?.Contents?.map((content) => content.Key as string) || []);
      });
    });
  }

  async getDebugFile(compareWith: string, target: string, debugLocation: string): Promise<Record<string, string>>{
    if (compareWith) {
      const debugFilePath = `${target}/${debugLocation}debug.${compareWith}.json`;
      try {
        const response = await this.s3Client.getObject({
          Bucket: configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
          Key: debugFilePath
        });
        if (response.Body === undefined) throw Error('debug JSON was undefined');
        const debugFileString = await response.Body.transformToString();
        return JSON.parse(debugFileString) as Record<string, string>;
      } catch (error) {
        Logger.log(2, error);
        return {};
      }
    }
    return {};
  }

  updateDebugFile(debugJSON: DebugJSON, target: string, debugLocation: string) {
    if (configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) return;
    const debugBuff = Buffer.from(JSON.stringify(debugJSON));
    this.s3Client.putObject(
      {
        Bucket: configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
        Key: `${target}/${debugLocation}debug.${configManagerInstance.getConfigValue('ZENITH_DEBUG_ID')}.json`,
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
}

export default RemoteCacher;
