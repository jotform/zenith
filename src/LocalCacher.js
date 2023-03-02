import { cpSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import ConfigHelper from './ConfigHelper';
import ROOT_PATH from './utils/Constants';

export default class LocalCacher {
  static cachePath = path.join(ROOT_PATH, ConfigHelper.getConfig('cachePath', ''));

  static isCached(hash) {
    const cachePath = path.join(this.cachePath, hash);
    return existsSync(cachePath);
  }

  static cache(hash, root, output) {
    try {
      const hashedPath = path.join(this.cachePath, hash, root, output);
      const inputPath = path.join(root, output);
      if (existsSync(inputPath)) {
        mkdirSync(hashedPath, { recursive: true });
        cpSync(inputPath, hashedPath, { recursive: true });
      }
    } catch (error) {
      console.log(error);
    }
  }

  static recoverFromCache(hash, root, output) {
    try {
      const hashedPath = path.join(this.cachePath, hash, root, output);
      const inputPath = path.join(root, output);
      if (existsSync(hashedPath)) {
        mkdirSync(inputPath, { recursive: true });
        cpSync(hashedPath, inputPath, { recursive: true });
      }
    } catch (error) {
      console.log(error);
    }
  }
}
