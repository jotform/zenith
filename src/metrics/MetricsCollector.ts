import { TaskMetrics, CacheSource } from '../types';

export const nowMs = (): number => Number(process.hrtime.bigint()) / 1e6;

/**
 * Per-task metrics accumulator. Lives as a module singleton inside the worker
 * process; safe because workerpool runs one task at a time per worker thread.
 * Every method is a pure counter — metrics must never fail a build.
 */
class MetricsCollector {
  private metrics: TaskMetrics = {};

  // Wall-clock windows for transfers: the earliest start and latest end across
  // all (possibly parallel) upload/download calls. Summing per-call durations
  // over-counts when transfers overlap, so archive/extract time is derived from
  // these spans instead (see getUploadWallMs/getDownloadWallMs).
  private uploadWindow?: { start: number; end: number };

  private downloadWindow?: { start: number; end: number };

  reset(): void {
    this.metrics = {};
    this.uploadWindow = undefined;
    this.downloadWindow = undefined;
  }

  addUpload(ms: number, bytes: number): void {
    this.metrics.uploadMs = (this.metrics.uploadMs ?? 0) + ms;
    this.metrics.uploadBytes = (this.metrics.uploadBytes ?? 0) + bytes;
  }

  addDownload(ms: number, bytes: number): void {
    this.metrics.downloadMs = (this.metrics.downloadMs ?? 0) + ms;
    this.metrics.downloadBytes = (this.metrics.downloadBytes ?? 0) + bytes;
  }

  /** Widens the upload wall-clock window with one call's [start, end] timestamps (ms). */
  noteUploadWindow(start: number, end: number): void {
    this.uploadWindow = this.uploadWindow
      ? { start: Math.min(this.uploadWindow.start, start), end: Math.max(this.uploadWindow.end, end) }
      : { start, end };
  }

  /** Widens the download wall-clock window with one call's [start, end] timestamps (ms). */
  noteDownloadWindow(start: number, end: number): void {
    this.downloadWindow = this.downloadWindow
      ? { start: Math.min(this.downloadWindow.start, start), end: Math.max(this.downloadWindow.end, end) }
      : { start, end };
  }

  addOutputStats(bytes: number, fileCount: number): void {
    this.metrics.outputBytes = (this.metrics.outputBytes ?? 0) + bytes;
    this.metrics.fileCount = (this.metrics.fileCount ?? 0) + fileCount;
  }

  setArchiveMs(ms: number): void { this.metrics.archiveMs = ms; }

  setExtractMs(ms: number): void { this.metrics.extractMs = ms; }

  getUploadMs(): number { return this.metrics.uploadMs ?? 0; }

  getDownloadMs(): number { return this.metrics.downloadMs ?? 0; }

  /** Real wall-clock time spent transferring, correct even when uploads overlap. */
  getUploadWallMs(): number { return this.uploadWindow ? this.uploadWindow.end - this.uploadWindow.start : 0; }

  /** Real wall-clock time spent transferring, correct even when downloads overlap. */
  getDownloadWallMs(): number { return this.downloadWindow ? this.downloadWindow.end - this.downloadWindow.start : 0; }

  /** Records which backend served the recovery; rides the snapshot back to the main process. */
  setRecoverySource(source: CacheSource): void { this.metrics.source = source; }

  snapshot(): TaskMetrics { return { ...this.metrics }; }
}

export { MetricsCollector };

export const metricsCollector = new MetricsCollector();
