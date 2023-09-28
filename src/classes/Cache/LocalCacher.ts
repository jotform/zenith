import { existsSync, mkdirSync, readFileSync, createWriteStream, readdirSync } from 'fs';
import * as path from 'path';
import { ROOT_PATH } from '../../utils/constants';
import Logger from '../../utils/logger';
import { DebugJSON } from '../../types/ConfigTypes';
import { NodeSystemError } from '../../types/BuildTypes';
import { configManagerInstance } from '../../config';
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
    if (this.isDebug()) {
      Logger.log(1, 'Cache path => ', this.cachePath);
    }
  }

  putObject({ Key, Body }: { Bucket?: string | undefined; Key: string; Body: string | Buffer; }): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const fullPath = path.join(this.cachePath, Key);
        const directoryPath = path.dirname(fullPath);
        if (!existsSync(directoryPath)) mkdirSync(directoryPath, { recursive: true });
        const writer = createWriteStream(fullPath);
        writer.write(Body);
        writer.end();
        if (this.isDebug()) Logger.log(1, 'Cached Locally => ', fullPath);
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
        const fullPath = path.join(this.cachePath, Key);
        const reader = readFileSync(fullPath);
        const readable = Readable.from(reader);
        if (this.isDebug()) Logger.log(1, 'Retrieved from cache => ', fullPath);
        resolve(readable);
      }
      catch (error) {
        const nodeError = error as NodeSystemError;
        if (nodeError.code === 'ENOENT') {
          reject(false);
          return;
        }
        Logger.log(2, error);
        reject(error);
      }
    });
  }

  listObjects({ Prefix }: { Bucket?: string | undefined; Prefix: string; }): Promise<string[]> {
    return new Promise((resolve, reject) => {
      try {
        const fullPath = path.join(this.cachePath, Prefix);
        const files = readdirSync(fullPath);
        const paths = files.map(file => path.join(Prefix, file));
        if (this.isDebug()) Logger.log(1, 'Listed from cache => ', paths);
        resolve(paths);
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
