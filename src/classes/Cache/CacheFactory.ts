import Cacher from './Cacher';
import LocalCacher from './LocalCacher';
import RemoteCacher from './RemoteCacher';
import MixedCacher from './MixedCacher';
import { configManagerInstance } from '../../config';

export default class CacherFactory {
    static getCacher(): Cacher {
      const cache = configManagerInstance.getConfigValue('CACHE_TYPE');
      switch (cache) {
        case 'local':
          return new LocalCacher();
        case 'remote':
          return new RemoteCacher();
        case 'mixed':
          return new MixedCacher() as Cacher;
        default:
          throw new Error('Invalid cache type');
      }
    }
  }