export const formatDurationMs = (ms?: number): string => {
  if (ms === undefined) return '-';
  const seconds = ms / 1000;
  if (seconds > 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${(seconds % 60).toFixed(1)}s`;
  }
  return `${seconds.toFixed(2)}s`;
};

export const formatBytes = (bytes?: number): string => {
  if (bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

export const formatCount = (count?: number): string => {
  if (count === undefined) return '-';
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1)}k`;
};

// 3-decimal seconds (minutes for long runs) — matches formatTimeDiff, the old summary style.
export const formatWallMs = (ms: number): string => {
  const seconds = ms / 1000;
  if (seconds > 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${(seconds % 60).toFixed(3)}s`;
  }
  return `${seconds.toFixed(3)}s`;
};
