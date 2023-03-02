const { cpSync, existsSync, mkdirSync } = require('fs');
const path = require('path');
const ConfigHelper = require('./ConfigHelper');
const { ROOT_PATH } = require('./src/utils/constants');
const RemoteCacher = require('./RemoteCacher');
const LocalCacher = require('./LocalCacher');

class Cacher {
  constructor() {
    const isRemoteCache = process.env.USE_REMOTE_CACHE;
    if (isRemoteCache) {
      this.cacher = RemoteCacher;
    } else {
      this.cacher = LocalCacher;
    }
  }
}

module.exports = Cacher;