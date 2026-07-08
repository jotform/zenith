import * as path from 'path';
import type { RmOptions } from 'fs';

export const ROOT_PATH = path.join(process.cwd());
export const SAVE_AS_TXT_KEYWORD = 'stdout';
export const SLOW_RECOVERY_THRESHOLD_MS = 10000;

// Recursive deletes on the cache recovery path go through this. On macOS,
// fs.rm's recursive teardown races with Finder/Spotlight recreating .DS_Store in
// the directory, so the final rmdir can see a non-empty dir and throw ENOTEMPTY.
// Node retries ENOTEMPTY/EBUSY/EPERM/EMFILE/ENFILE when maxRetries/retryDelay are
// set, which absorbs the race.
export const RECURSIVE_RM_OPTIONS: RmOptions = {
  recursive: true, force: true, maxRetries: 5, retryDelay: 100,
};
