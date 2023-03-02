import * as fs from 'fs';
import * as path from 'path';;
import ConfigHelper from './ConfigHelper';
import ROOT_PATH from './utils/Constants';

export default class LocalCacher {
  static cachePath = path.join(ROOT_PATH, ConfigHelper.getConfig('cachePath', ''));

  static isCached(hash) {
    const cachePath = path.join(this.cachePath, hash);
    return fs.existsSync(cachePath);
  }

  static cache(hash, root, output) {
    try {
      const hashedPath = path.join(this.cachePath, hash, root, output);
      const inputPath = path.join(root, output);
      if (fs.existsSync(inputPath)) {
        fs.mkdirSync(hashedPath, { recursive: true });
        fs.cpSync(inputPath, hashedPath, { recursive: true });
      }
    } catch (error) {
      console.log(error);
    }
  }

  static recoverFromCache(hash, root, output) {
    try {
      const hashedPath = path.join(this.cachePath, hash, root, output);
      const inputPath = path.join(root, output);
      if (fs.existsSync(hashedPath)) {
        fs.mkdirSync(inputPath, { recursive: true });
        fs.cpSync(hashedPath, inputPath, { recursive: true });
      }
    } catch (error) {
      console.log(error);
    }
  }
}
