import RemoteCacher from './RemoteCacher';
import LocalCacher from './LocalCacher';

export default class Cacher {
  constructor() {
    const isRemoteCache = process.env.USE_REMOTE_CACHE;
    if (isRemoteCache) {
      this.cacher = RemoteCacher;
    } else {
      this.cacher = LocalCacher;
    }
  }
}
