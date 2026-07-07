import * as path from 'path';
import { existsSync } from 'fs';
import { metricsCollector } from '../../../metrics/MetricsCollector';
import { isOutputTxt } from '../../../utils/functions';
import { getDirectoryFileStats } from '../cacheFormats/directoryStats';
import { ROOT_PATH } from '../../../utils/constants';

/**
 * Records raw output size once per task, in the worker — NOT inside
 * Cacher.cache(), where hybrid mode's two children would double-count it.
 */
export const recordOutputStats = async (root: string, outputs: Array<string>, commandOutput: string): Promise<void> => {
  for (const output of outputs) {
    try {
      if (isOutputTxt(output)) {
        metricsCollector.addOutputStats(Buffer.byteLength(commandOutput), 0);
        continue;
      }
      const directoryPath = path.join(ROOT_PATH, root, output);
      if (!existsSync(directoryPath)) continue;
      // eslint-disable-next-line no-await-in-loop
      const stats = await getDirectoryFileStats(directoryPath);
      metricsCollector.addOutputStats(stats.totalBytes, stats.fileCount);
    } catch {
      // best-effort: metrics must never fail a build
    }
  }
};
