import { ProjectRunStats } from '../types/BuildTypes';
import { SLOW_RECOVERY_THRESHOLD_MS } from '../utils/constants';
import { hrtimeToMs } from '../utils/time';
import { formatBytes, formatCount, formatDurationMs } from './statsFormat';
import { rowTotalMs, xferBytesOf } from './statsMetrics';

// "Build" table — the timing story (with sizes), one row per built/recovered project, slowest first.
export const buildTimeTable = (stats: Map<string, ProjectRunStats>, opts: { builtOnly?: boolean } = {}): Array<Record<string, string>> => Array.from(stats.entries())
  .filter(([, projectStats]) => projectStats.status !== 'SKIP' && (!opts.builtOnly || projectStats.status !== 'HIT'))
  .sort((a, b) => rowTotalMs(b[1]) - rowTotalMs(a[1]))
  .map(([project, projectStats]) => {
    const m = projectStats.metrics ?? {};
    const recoverMs = (m.downloadMs ?? 0) + (m.extractMs ?? 0);
    const slowMark = recoverMs > SLOW_RECOVERY_THRESHOLD_MS ? ' !' : '';
    return {
      Project: project,
      Source: projectStats.status === 'HIT' ? (projectStats.metrics?.source ?? '-') : 'built',
      Exec: projectStats.execTime ? formatDurationMs(hrtimeToMs(projectStats.execTime)) : '-',
      Hash: formatDurationMs(projectStats.hashMs),
      Arch: formatDurationMs(m.archiveMs),
      Up: formatDurationMs(m.uploadMs),
      Down: formatDurationMs(m.downloadMs),
      Extr: m.extractMs === undefined ? '-' : `${formatDurationMs(m.extractMs)}${slowMark}`,
      Total: formatDurationMs(rowTotalMs(projectStats)),
      'Out Size': formatBytes(m.outputBytes),
      Files: formatCount(m.fileCount),
      'Cache Size': formatBytes(xferBytesOf(m)),
    };
  });

// "Largest Artifacts" table — the size story, biggest uncompressed output first, with each project's total time.
export const buildSizeTable = (stats: Map<string, ProjectRunStats>, opts: { builtOnly?: boolean } = {}): Array<Record<string, string>> => Array.from(stats.entries())
  .filter(([, projectStats]) => projectStats.status !== 'SKIP' && projectStats.metrics?.outputBytes !== undefined && (!opts.builtOnly || projectStats.status !== 'HIT'))
  .sort((a, b) => (b[1].metrics?.outputBytes ?? 0) - (a[1].metrics?.outputBytes ?? 0))
  .map(([project, projectStats]) => {
    const m = projectStats.metrics ?? {};
    return {
      Project: project,
      'Out Size': formatBytes(m.outputBytes),
      Files: formatCount(m.fileCount),
      'Cache Size': formatBytes(xferBytesOf(m)),
      Total: formatDurationMs(rowTotalMs(projectStats)),
    };
  });
