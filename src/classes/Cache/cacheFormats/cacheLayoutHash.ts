import { createHash } from 'crypto';
import type { CacheFormatName } from './AbstractCacheFormat';

const LAYOUT_SALT = 'zenith-cache-layout-v1';

/** Stable secondary hash so zip / tar / files / blobs never share the same remote/local prefix for the same source hash. */
export const deriveCacheLayoutHash = (sourceContentHash: string, format: CacheFormatName): string =>
  createHash('sha256')
    .update(`${LAYOUT_SALT}\0${sourceContentHash}\0${format}`)
    .digest('hex');
