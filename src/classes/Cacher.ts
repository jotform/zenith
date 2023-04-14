import RemoteCacher from './RemoteCacher';
import LocalCacher from './LocalCacher';
import { configManagerInstance } from '../config';

export default class Cacher {
  cacher: typeof RemoteCacher | LocalCacher;

  constructor() {
    const isRemoteCache = configManagerInstance.getConfigValue('USE_REMOTE_CACHE');
    if (isRemoteCache) {
      this.cacher = RemoteCacher;
    } else {
      this.cacher = new LocalCacher();
    }
  }
}
