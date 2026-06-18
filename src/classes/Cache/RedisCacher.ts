import { createClient, RedisClientType } from 'redis';
import { Readable } from 'stream';
import Logger from '../../utils/logger';
import { DebugJSON } from '../../types/ConfigTypes';
import { configManagerInstance } from '../../config';
import { isReadableStreamBody, readableToBuffer } from '../../utils/functions';
import Cacher from './Cacher';

class RedisCacher extends Cacher {
  private client: RedisClientType;

  private keyPrefix: string;

  private connected = false;

  constructor() {
    super();
    this.keyPrefix = configManagerInstance.getConfigValue('REDIS_KEY_PREFIX');
    this.client = createClient({
      url: configManagerInstance.getConfigValue('REDIS_URL'),
    });
    this.client.on('error', (err) => Logger.log(2, err));
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  private fullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private static async bodyToBuffer(Body: string | Buffer | Readable): Promise<Buffer> {
    if (isReadableStreamBody(Body)) {
      return readableToBuffer(Body);
    }
    if (typeof Body === 'string') return Buffer.from(Body);
    return Body;
  }

  putObject({ Key, Body }: { Bucket?: string | undefined; Key: string; Body: string | Buffer | Readable }): Promise<void> {
    return (async () => {
      await this.ensureConnected();
      const data = await RedisCacher.bodyToBuffer(Body);
      await this.client.set(this.fullKey(Key), data);
      if (this.isDebug()) Logger.log(1, 'Cached in Redis => ', this.fullKey(Key));
      Logger.log(3, 'Cache successfully stored to redis');
    })().catch((err) => {
      Logger.log(2, err);
      throw err;
    });
  }

  getObject({ Key }: { Bucket?: string | undefined; Key: string }): Promise<Readable> {
    return (async () => {
      await this.ensureConnected();
      const data = await this.client.get(
        this.client.commandOptions({ returnBuffers: true }),
        this.fullKey(Key)
      );
      if (data === null) {
        const metadata = {
          code: 'NoSuchKey',
          message: 'The specified key does not exist.',
          key: Key,
          httpStatusCode: 404,
        };
        throw { $metadata: metadata };
      }
      if (this.isDebug()) Logger.log(1, 'Retrieved from Redis => ', this.fullKey(Key));
      Logger.log(3, 'Cache successfully retrieved from redis');
      return Readable.from(data);
    })().catch((err) => {
      if ((err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404) {
        throw err;
      }
      Logger.log(2, err);
      throw err;
    });
  }

  async getDebugFile(compareWith: string, target: string, debugLocation: string): Promise<Record<string, string>> {
    if (!compareWith) return {};
    try {
      const debugFilePath = `${target}/${debugLocation}debug.${compareWith}.json`;
      const response = await this.getObject({ Key: debugFilePath });
      const debugFileString = await this.txtPipeEnd(response);
      return JSON.parse(debugFileString) as Record<string, string>;
    } catch (error) {
      Logger.log(2, error);
      return {};
    }
  }

  updateDebugFile(debugJSON: DebugJSON, target: string, debugLocation: string): void {
    if (configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) return;
    const debugBuff = Buffer.from(JSON.stringify(debugJSON));
    const debugFilePath = `${target}/${debugLocation}debug.${configManagerInstance.getConfigValue('ZENITH_DEBUG_ID')}.json`;
    void this.putObject({ Key: debugFilePath, Body: debugBuff });
  }
}

export default RedisCacher;
