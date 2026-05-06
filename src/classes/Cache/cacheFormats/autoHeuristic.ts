import type { DirectoryFileStats } from './directoryStats';

const MANY_FILES_THRESHOLD = 400;

const FEW_FILES_MAX = 48;

const LARGE_FILE_BYTES = 4 * 1024 * 1024;

const SMALL_TREE_MAX = 24;

/**
 * Picks a concrete cache format. No single format wins every workload; this
 * balances request overhead (many small files → archive) vs CPU (tar vs zip)
 * vs large blobs (content-addressed + multipart-friendly paths).
 */
export const resolveAutoCacheFormat = (stats: DirectoryFileStats): 'tar' | 'zip' | 'files' | 'blobs' => {
  const manyFiles = MANY_FILES_THRESHOLD;
  const fewFiles = FEW_FILES_MAX;
  const largeFileBytes = LARGE_FILE_BYTES;
  const smallTreeMax = SMALL_TREE_MAX;

  const { fileCount, totalBytes, maxFileBytes } = stats;
  const avg = fileCount > 0 ? totalBytes / fileCount : 0;

  if (fileCount >= manyFiles || (fileCount > 50 && avg < 256 * 1024)) {
    return 'tar';
  }
  if (fileCount <= fewFiles && maxFileBytes >= largeFileBytes) {
    return 'blobs';
  }
  if (fileCount <= smallTreeMax) {
    return 'files';
  }
  if (fileCount > 200) {
    return 'tar';
  }
  return 'zip';
};
