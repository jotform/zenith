import { existsSync, mkdirSync, readFileSync, createWriteStream } from 'fs';
import * as path from 'path';
import { ROOT_PATH } from '../utils/constants';
import Logger from '../utils/logger';
import { DebugJSON } from '../types/ConfigTypes';
import { NodeSystemError } from '../types/BuildTypes';
import { configManagerInstance } from '../config';
import Cacher from './Cacher';
import { Readable } from 'stream';

class LocalCacher extends Cacher {
  cachePath = '';

  constructor() {
    super();
    this.cachePath = configManagerInstance.getCachePath();
    if (!path.isAbsolute(this.cachePath)) {
      this.cachePath = path.join(ROOT_PATH, this.cachePath);
    }
    if (!existsSync(this.cachePath)) {
      mkdirSync(this.cachePath);
    }
  }

  putObject({ Key, Body }: { Bucket?: string | undefined; Key: string; Body: string | Buffer; }): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!existsSync(Key)) mkdirSync(Key, { recursive: true });
        const writer = createWriteStream(Key);
        writer.write(Body);
        writer.end();
        resolve();
      }
      catch (error) {
        Logger.log(2, error);
        reject(error);
      }
    });
  }

  getObject({ Key }: { Bucket?: string | undefined; Key: string; }): Promise<Readable> {
    return new Promise((resolve, reject) => {
      try {
        const reader = readFileSync(Key);
        const readable = Readable.from(reader);
        resolve(readable);
      }
      catch (error) {
        Logger.log(2, error);
        reject(error);
      }
    });
  }

  listObjects({ Prefix }: { Bucket?: string | undefined; Prefix: string; }): Promise<string[]> {
    return new Promise((resolve, reject) => {
      try {
        const files = readFileSync(Prefix);
        resolve(files.toString().split('\n'));
      }
      catch (error) {
        const nodeError = error as NodeSystemError;
        if (nodeError.code === 'ENOENT') {
          resolve([]);
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
