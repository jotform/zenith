export type CacheSource = 'local' | 'remote';

export type TaskMetrics = {
  // cache write (MISS path)
  archiveMs?: number;      // cache-write wall time − upload WALL span (remainder, clamped ≥ 0)
  uploadMs?: number;       // summed time inside putObject (over-counts when uploads overlap)
  uploadBytes?: number;    // artifact bytes sent to cache

  // recovery (HIT path)
  downloadMs?: number;     // summed getObject → stream end (over-counts when downloads overlap)
  downloadBytes?: number;  // bytes off the wire
  extractMs?: number;      // recoverFromCache wall time − download WALL span (remainder, clamped ≥ 0)
  source?: CacheSource;    // which backend served the hit (local vs remote)

  // raw output
  outputBytes?: number;    // uncompressed output size (project-level: max-merged across outputs)
  fileCount?: number;      // number of output files (project-level: max-merged across outputs)
};

export type CommandExecutionOutput = {
  output: string;
  execTime?: [number, number];
  cacheTime?: [number, number];
  metrics?: TaskMetrics;
}

export type CacheRecoveryOutput = {
  result: boolean | string;
  time: [number, number];
  metrics?: TaskMetrics;
}