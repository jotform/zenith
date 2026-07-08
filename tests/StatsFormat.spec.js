import { hrtimeToMs } from '../src/utils/time';
import { formatDurationMs, formatBytes, formatCount } from '../src/stats/statsFormat';
import { mergeTaskMetrics } from '../src/stats/statsMetrics';
import { SLOW_RECOVERY_THRESHOLD_MS } from '../src/utils/constants';

describe('stats formatting primitives', () => {
  it('hrtimeToMs converts [seconds, nanoseconds] to milliseconds', () => {
    expect(hrtimeToMs([2, 500000000])).toBe(2500);
    expect(hrtimeToMs([0, 0])).toBe(0);
  });

  it('formatDurationMs formats undefined, seconds, and minutes', () => {
    expect(formatDurationMs(undefined)).toBe('-');
    expect(formatDurationMs(310)).toBe('0.31s');
    expect(formatDurationMs(42100)).toBe('42.10s');
    expect(formatDurationMs(135000)).toBe('2m 15.0s');
  });

  it('formatBytes formats undefined, B, KB, MB, GB', () => {
    expect(formatBytes(undefined)).toBe('-');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2 * 1024)).toBe('2.0 KB');
    expect(formatBytes(18.4 * 1024 * 1024)).toBe('18.4 MB');
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
  });

  it('formatCount abbreviates thousands', () => {
    expect(formatCount(undefined)).toBe('-');
    expect(formatCount(312)).toBe('312');
    expect(formatCount(1200)).toBe('1.2k');
  });

  it('mergeTaskMetrics sums defined fields and keeps undefined ones absent', () => {
    expect(mergeTaskMetrics(undefined, undefined)).toBeUndefined();
    expect(mergeTaskMetrics({ uploadMs: 5 }, undefined)).toEqual({ uploadMs: 5 });
    const merged = mergeTaskMetrics(
      { uploadMs: 5, uploadBytes: 100, outputBytes: 10 },
      { uploadMs: 3, downloadMs: 7 },
    );
    expect(merged).toEqual({ uploadMs: 8, uploadBytes: 100, downloadMs: 7, outputBytes: 10 });
    expect(merged.extractMs).toBeUndefined();
  });

  it('mergeTaskMetrics max-merges project-level fields so multi-output metas do not inflate', () => {
    const perOutput = { downloadMs: 100, outputBytes: 5000, fileCount: 40 };
    const merged = mergeTaskMetrics(perOutput, { downloadMs: 60, outputBytes: 5000, fileCount: 40 });
    expect(merged).toEqual({ downloadMs: 160, outputBytes: 5000, fileCount: 40 });
  });

  it('exposes the slow-recovery threshold', () => {
    expect(SLOW_RECOVERY_THRESHOLD_MS).toBe(10000);
  });
});
