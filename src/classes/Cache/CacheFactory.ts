import Cacher from './Cacher';
import LocalCacher from './LocalCacher';
import RemoteCacher from './RemoteCacher';
import { configManagerInstance } from '../../config';

export default class CacherFactory {
    static getCacher(): Cacher {
      if (configManagerInstance.getConfigValue('USE_REMOTE_CACHE')) {
        return new RemoteCacher();
      }
      return new LocalCacher();
    }
  }