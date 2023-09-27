import Cacher from './Cacher';
import LocalCacher from './LocalCacher';
import RemoteCacher from './RemoteCacher';
import HybridCacher from './HybridCacher';
import { configManagerInstance } from '../../config';

export default class CacherFactory {
  static getCacher(): Cacher {
    const cache = configManagerInstance.getConfigValue('CACHE_TYPE');
    switch (cache) {
      case 'local':
        return new LocalCacher();
      case 'remote':
        return new RemoteCacher();
      case 'local-first':
      case 'remote-first':
        return new HybridCacher(cache) as Cacher;
      default:
        throw new Error('Invalid cache type');
    }
  }
}