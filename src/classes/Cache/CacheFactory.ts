import Cacher from './Cacher';
import LocalCacher from './LocalCacher';
import RemoteCacher from './RemoteCacher';
import RedisCacher from './RedisCacher';
import HybridCacher from './HybridCacher';
import { configManagerInstance } from '../../config';
import { decorateCacherWithMetrics } from './metrics/cacherMetricsDecorator';

export default class CacherFactory {
  static getCacher(): Cacher {
    const cache = configManagerInstance.getConfigValue('CACHE_TYPE');
    switch (cache) {
      case 'local':
        return decorateCacherWithMetrics(new LocalCacher());
      case 'remote':
        return decorateCacherWithMetrics(new RemoteCacher());
      case 'redis':
        return decorateCacherWithMetrics(new RedisCacher());
      case 'local-first':
      case 'remote-first':
        // HybridCacher decorates its own children (see its constructor).
        return new HybridCacher(cache) as Cacher;
      default:
        throw new Error('Invalid cache type');
    }
  }
}
