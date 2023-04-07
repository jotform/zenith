import { cpSync, existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import ConfigHelper from './ConfigHelper';
import { ROOT_PATH } from '../utils/constants';
import Logger from '../utils/logger';
import { DebugJSON } from '../types/ConfigTypes';

export default class LocalCacher {
  static cachePath = path.join(ROOT_PATH, ConfigHelper.getCachePath());

  static isCached(hash: string): boolean {
    const cachePath = path.join(this.cachePath, hash);
    return existsSync(cachePath);
  }

  static cache(hash: string, root: string, output: string): void {
    try {
      const hashedPath = path.join(this.cachePath, hash, root, output);
      const inputPath = path.join(root, output);
      if (existsSync(inputPath)) {
        mkdirSync(hashedPath, { recursive: true });
        cpSync(inputPath, hashedPath, { recursive: true });
      }
    } catch (error) {
      Logger.log(2, error);
    }
  }

  static recoverFromCache(hash: string, root: string, output: string): void {
    try {
      const hashedPath = path.join(this.cachePath, hash, root, output);
      const inputPath = path.join(root, output);
      if (existsSync(hashedPath)) {
        mkdirSync(inputPath, { recursive: true });
        cpSync(hashedPath, inputPath, { recursive: true });
      }
    } catch (error) {
      Logger.log(2, error);
    }
  }

  // implementation not finished!
  getDebugFile(compareWith: string, command: string, debugLocation: string): Promise<void> {
    Logger.log(4, command, compareWith, debugLocation);
    return new Promise(resolve => resolve());
  }

  updateDebugFile(debugJSON: DebugJSON, target: string, debugLocation: string): void {
    Logger.log(4, debugJSON, target, debugLocation);
  }

  sendOutputHash(hash: string, root: string, output: string, target: string): void {
    Logger.log(4, hash, root, output, target);
  }

  async isCached(hash: string, root: string, outputs: Array<string>, target: string): Promise<void> {
    Logger.log(4, hash, root, outputs, target);
    return new Promise(resolve => resolve());
  }
}
