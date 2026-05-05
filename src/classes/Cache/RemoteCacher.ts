import { S3 } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'fs';
import { stat, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import Logger from '../../utils/logger';
import { DebugJSON } from '../../types/ConfigTypes';
import { configManagerInstance } from '../../config';
import { isReadableStreamBody } from '../../utils/functions';
import Cacher from './Cacher';

class RemoteCacher extends Cacher {
  s3Client: S3 = undefined as unknown as S3;

  constructor() {
    super();
    const S3_ACCESS_KEY = configManagerInstance.getConfigValue('S3_ACCESS_KEY');
    const S3_SECRET_KEY = configManagerInstance.getConfigValue('S3_SECRET_KEY');
    const endpoint = configManagerInstance.getConfigValue('S3_ENDPOINT');
    const forcePathStyle = configManagerInstance.getConfigValue('S3_FORCE_PATH_STYLE');
    this.s3Client = new S3({
      region: configManagerInstance.getConfigValue('S3_REGION'),
      ...(endpoint ? { endpoint } : {}),
      ...(forcePathStyle ? { forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY
      }
    });
  }

  putObject({ Bucket, Key, Body }: { Bucket?: string | undefined, Key: string; Body: string | Buffer | Readable }): Promise<void> {
    return (async () => {
      const buck = Bucket || configManagerInstance.getConfigValue('S3_BUCKET_NAME');
      if (isReadableStreamBody(Body)) {
        const tmp = join(tmpdir(), `zenith-upload-${randomBytes(16).toString('hex')}.zip`);
        await pipeline(Body, createWriteStream(tmp));
        const st = await stat(tmp);
        const rs = createReadStream(tmp);
        try {
          await this.s3Client.putObject({
            Bucket: buck,
            Key,
            Body: rs,
            ContentLength: st.size,
          });
        } finally {
          rs.destroy();
          await unlink(tmp).catch(() => undefined);
        }
        Logger.log(3, 'Cache successfully stored to remote');
        return;
      }
      await this.s3Client.putObject({
        Bucket: buck,
        Key,
        Body,
      });
      Logger.log(3, 'Cache successfully stored to remote');
    })().catch((err) => {
      Logger.log(2, err);
      throw err;
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
        Logger.log(3, 'Cache successfully retrieved from remote');
        resolve(data?.Body as Readable);
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
