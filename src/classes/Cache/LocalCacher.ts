import { existsSync, mkdirSync, readFileSync, createWriteStream } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as fsp from 'fs/promises';
import { ROOT_PATH } from '../../utils/constants';
import Logger from '../../utils/logger';
import { DebugJSON } from '../../types/ConfigTypes';
import { NodeSystemError } from '../../types/BuildTypes';
import { configManagerInstance } from '../../config';
import { isReadableStreamBody } from '../../utils/functions';
import Cacher from './Cacher';
import Hasher from '../Hasher';

class LocalCacher extends Cacher {
  cachePath = '';
  hasher = new Hasher();

  constructor() {
    super();
    this.cachePath = configManagerInstance.getCachePath();
    if (!path.isAbsolute(this.cachePath)) {
      this.cachePath = path.join(ROOT_PATH, this.cachePath);
    }
    if (!existsSync(this.cachePath)) {
      mkdirSync(this.cachePath);
    }
    if (this.isDebug()) {
      Logger.log(1, 'Cache path => ', this.cachePath);
    }
  }

  putObject({ Key, Body }: { Bucket?: string | undefined; Key: string; Body: string | Buffer | Readable; }): Promise<void> {
    return (async () => {
      const fullPath = path.join(this.cachePath, Key);
      const directoryPath = path.dirname(fullPath);
      if (!existsSync(directoryPath)) mkdirSync(directoryPath, { recursive: true });
      if (isReadableStreamBody(Body)) {
        await pipeline(Body, createWriteStream(fullPath));
      } else {
        await fsp.writeFile(fullPath, Body);
      }
      if (this.isDebug()) Logger.log(1, 'Cached Locally => ', fullPath);
    })();
  }

  getObject({ Key }: { Bucket?: string | undefined; Key: string; }): Promise<Readable> {
    return new Promise((resolve, reject) => {
      try {
        const fullPath = path.join(this.cachePath, Key);
        const reader = readFileSync(fullPath);
        const readable = Readable.from(reader);
        if (this.isDebug()) Logger.log(1, 'Retrieved from cache => ', fullPath);
        resolve(readable);
      }
      catch (error) {
        const nodeError = error as NodeSystemError;
        if (nodeError.code === 'ENOENT') {
          const metadata = {
            code: 'NoSuchKey',
            message: 'The specified key does not exist.',
            key: Key,
            httpStatusCode: 404
          };
          reject({ $metadata: metadata });
          return;
        }
        Logger.log(2, error);
        reject(error);
      }
    });
  }

  async getDebugFile(compareWith: string, target: string, debugLocation: string): Promise<Record<string, string>> {
    return new Promise((resolve) => {
      if (compareWith) {
        try {
          const debugFilePath = path.join(this.cachePath, `${target}/${debugLocation}debug.${compareWith}.json`);
          const debugFileString = readFileSync(debugFilePath, { encoding: 'utf-8' });
          resolve(JSON.parse(debugFileString) as Record<string, string>);
        } catch (error) {
          Logger.log(2, error);
          resolve({});
        }
      }
      resolve({});
    });
  }

  updateDebugFile(debugJSON: DebugJSON, target: string, debugLocation: string) {
    if (configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) return;
    const debugBuff = Buffer.from(JSON.stringify(debugJSON));
    const debugFilePath = path.join(this.cachePath, `${target}/${debugLocation}debug.${configManagerInstance.getConfigValue('ZENITH_DEBUG_ID')}.json`);

    const writer = createWriteStream(debugFilePath);
    writer.write(debugBuff);
    writer.end();
  }
}

export default LocalCacher;
