import { CACHE_FORMATS, configManagerInstance } from '../../../config';
import { getDirectoryFileStats } from './directoryStats';
import { resolveAutoCacheFormat } from './autoHeuristic';
import type { CacheFormatName } from './AbstractCacheFormat';

export type ConcreteCacheFormat = CacheFormatName;

export type ConfiguredCacheFormat = ConcreteCacheFormat | 'auto';

/** Order used when probing legacy caches (single prefix, multiple object layouts). */
export const LEGACY_MULTI_FORMAT_PROBE_ORDER: ConcreteCacheFormat[] = ['files', 'blobs', 'tar', 'zip'];

export const getConfiguredCacheFormat = (): ConfiguredCacheFormat => {
  const configured = configManagerInstance.getConfigValue('ZENITH_CACHE_FORMAT');
  if (configured === CACHE_FORMATS.AUTO) return 'auto';
  if (
    configured === CACHE_FORMATS.FILES
    || configured === CACHE_FORMATS.ZIP
    || configured === CACHE_FORMATS.TAR
    || configured === CACHE_FORMATS.BLOBS
  ) {
    return configured as ConcreteCacheFormat;
  }
  return CACHE_FORMATS.ZIP;
};

export const resolveEffectiveConcreteFormat = async (directoryPath: string): Promise<ConcreteCacheFormat> => {
  const configured = getConfiguredCacheFormat();
  if (configured !== 'auto') return configured;
  const stats = await getDirectoryFileStats(directoryPath);
  return resolveAutoCacheFormat(stats);
};

/** Formats to try for the layout-derived path (new caches). */
export const getFormatsToProbeForLayoutPath = (): ConcreteCacheFormat[] => {
  const configured = getConfiguredCacheFormat();
  if (configured !== 'auto') return [configured];
  return [...LEGACY_MULTI_FORMAT_PROBE_ORDER];
};

const FILES_UPLOAD_CONCURRENCY = 8;

const FILES_DOWNLOAD_CONCURRENCY = 8;

const FILES_INLINE_MAX_BYTES = 256 * 1024;

export const getFilesUploadConcurrency = (): number => FILES_UPLOAD_CONCURRENCY;

export const getFilesDownloadConcurrency = (): number => FILES_DOWNLOAD_CONCURRENCY;

export const getFilesInlineMaxBytes = (): number => FILES_INLINE_MAX_BYTES;
