import { ProjectRunStats, ProjectStatus } from '../types/BuildTypes';
import { mergeTaskMetrics } from './statsMetrics';

/**
 * Accumulates per-project run stats across the build lifecycle. Extracted from
 * BuildHelper so the status/precedence/merge logic is unit-testable in isolation.
 */
export default class StatsAggregator {
  readonly projectStats: Map<string, ProjectRunStats> = new Map();

  get size(): number { return this.projectStats.size; }

  record(buildProject: string, patch: Partial<ProjectRunStats>): void {
    const existing = this.projectStats.get(buildProject);
    if (!existing) {
      this.projectStats.set(buildProject, {
        status: patch.status ?? 'SKIP',
        execTime: patch.execTime,
        hashMs: patch.hashMs,
        metrics: patch.metrics,
      });
      return;
    }
    if (patch.status) {
      // a rebuild outranks a hit; anything outranks the SKIP placeholder
      const precedence: Record<ProjectStatus, number> = { SKIP: 0, HIT: 1, BUILT: 2, STALE: 3, MISS: 3 };
      if (precedence[patch.status] >= precedence[existing.status]) existing.status = patch.status;
    }
    if (patch.execTime) existing.execTime = patch.execTime;
    if (patch.hashMs !== undefined) existing.hashMs = (existing.hashMs ?? 0) + patch.hashMs;
    if (patch.metrics) existing.metrics = mergeTaskMetrics(existing.metrics, patch.metrics);
  }
}
