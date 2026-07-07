import { ProjectRunStats, ProjectStatus } from '../types/BuildTypes';
import { STATS_MODES } from '../config';
import { formatWallMs } from './statsFormat';
import { rowTotalMs } from './statsMetrics';

// Maps a --stats mode to render decisions. silent → summary only; default → tables of
// built projects; full → tables of all projects (cache hits included). Neither caps rows.
export const statsRenderPlan = (mode: STATS_MODES): { showTables: boolean; builtOnly: boolean } => ({
  showTables: mode !== STATS_MODES.SILENT,
  builtOnly: mode === STATS_MODES.DEFAULT,
});

export type StatsSummaryContext = {
  wallMs: number;
};

export const buildStatsSummary = (stats: Map<string, ProjectRunStats>, context?: StatsSummaryContext): string[] => {
  const counts: Record<ProjectStatus, number> = { HIT: 0, MISS: 0, STALE: 0, SKIP: 0, BUILT: 0 };
  let busyMs = 0;
  stats.forEach(projectStats => {
    counts[projectStats.status] += 1;
    busyMs += rowTotalMs(projectStats);
  });

  const built = counts.MISS + counts.STALE + counts.BUILT;
  const fromCache = counts.HIT;
  const wallMs = context?.wallMs ?? 0;
  const parallelism = wallMs > 0 ? (busyMs / wallMs).toFixed(1) : '0.0';

  return [
    `Total of ${stats.size} project${stats.size === 1 ? ' is' : 's are'} finished.`,
    `${fromCache} projects used from cache,`,
    `${built} projects used without cache.`,
    '',
    `Total process took ${formatWallMs(wallMs)}. (parallelism ${parallelism}x)`,
  ];
};
