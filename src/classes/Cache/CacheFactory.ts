import Cacher from './Cacher';
import LocalCacher from './LocalCacher';
import RemoteCacher from './RemoteCacher';
import RedisCacher from './RedisCacher';
import HybridCacher from './HybridCacher';
import { configManagerInstance, CACHE_TYPES } from '../../config';
import { decorateCacherWithMetrics } from './metrics/cacherMetricsDecorator';

export default class CacherFactory {
  static getCacher(): Cacher {
    const cache = configManagerInstance.getConfigValue('CACHE_TYPE');
    switch (cache) {
      case CACHE_TYPES.LOCAL:
        return decorateCacherWithMetrics(new LocalCacher());
      case CACHE_TYPES.REMOTE:
        return decorateCacherWithMetrics(new RemoteCacher());
      case CACHE_TYPES.REDIS:
        return decorateCacherWithMetrics(new RedisCacher());
      case CACHE_TYPES.LOCAL_FIRST:
      case CACHE_TYPES.REMOTE_FIRST:
        // HybridCacher decorates its own children (see its constructor).
        return new HybridCacher(cache);
      default:
        throw new Error('Invalid cache type');
    }
  }
}
