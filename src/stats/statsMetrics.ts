import { TaskMetrics } from '../types';
import { ProjectRunStats } from '../types/BuildTypes';
import { hrtimeToMs } from '../utils/time';

type NumericMetricKey = Exclude<keyof TaskMetrics, 'source'>;

const ADDITIVE_METRIC_KEYS: Array<NumericMetricKey> = [
  'archiveMs', 'uploadMs', 'uploadBytes', 'downloadMs', 'downloadBytes', 'extractMs',
];

// These describe the whole project; a multi-output project reports them once
// per output, so max-merge rather than sum so N-output projects don't inflate N×.
const PROJECT_LEVEL_METRIC_KEYS: Array<NumericMetricKey> = [
  'outputBytes', 'fileCount',
];

export const mergeTaskMetrics = (a?: TaskMetrics, b?: TaskMetrics): TaskMetrics | undefined => {
  if (!a) return b;
  if (!b) return a;
  const merged: TaskMetrics = {};
  ADDITIVE_METRIC_KEYS.forEach(key => {
    const left = a[key];
    const right = b[key];
    if (left === undefined && right === undefined) return;
    merged[key] = (left ?? 0) + (right ?? 0);
  });
  PROJECT_LEVEL_METRIC_KEYS.forEach(key => {
    const left = a[key];
    const right = b[key];
    if (left === undefined && right === undefined) return;
    merged[key] = Math.max(left ?? 0, right ?? 0);
  });
  if (a.source !== undefined || b.source !== undefined) merged.source = a.source ?? b.source;
  return merged;
};

export const rowTotalMs = (stats: ProjectRunStats): number => {
  const m = stats.metrics ?? {};
  return (stats.execTime ? hrtimeToMs(stats.execTime) : 0) + (stats.hashMs ?? 0)
    + (m.archiveMs ?? 0) + (m.uploadMs ?? 0) + (m.downloadMs ?? 0) + (m.extractMs ?? 0);
};

export const xferBytesOf = (m: TaskMetrics): number | undefined => (m.uploadBytes === undefined && m.downloadBytes === undefined
  ? undefined
  : (m.uploadBytes ?? 0) + (m.downloadBytes ?? 0));
