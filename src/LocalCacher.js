const { cpSync, existsSync, mkdirSync } = require('fs');
const path = require('path');
const ConfigHelper = require('./ConfigHelper');
const { ROOT_PATH } = require('./src/utils/constants');

class LocalCacher {
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

module.exports = LocalCacher;