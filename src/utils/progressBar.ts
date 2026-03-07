import * as cliProgress from 'cli-progress';

export interface ProgressBarOptions {
  total: number;
  showPercentage?: boolean;
  showETA?: boolean;
  label?: string;
}

export class ProgressBar {
  private bar: cliProgress.SingleBar;
  private current = 0;
  private total: number;
  private enabled = true;

  constructor(options: ProgressBarOptions) {
    this.total = options.total;
    
    this.bar = new cliProgress.SingleBar({
      format: `${options.label || 'Progress'} |{bar}| {percentage}% | {value}/{total} | {status}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
    }, cliProgress.Presets.shades_classic);
  }

  start(): void {
    if (!this.enabled) return;
    this.bar.start(this.total, 0, { status: 'Starting...' });
  }

  update(value: number, status?: string): void {
    if (!this.enabled) return;
    this.current = value;
    this.bar.update(value, { status: status || 'Building...' });
  }

  increment(status?: string): void {
    if (!this.enabled) return;
    this.current++;
    this.bar.update(this.current, { status: status || 'Building...' });
  }

  stop(status?: string): void {
    if (!this.enabled) return;
    this.bar.update(this.total, { status: status || 'Complete!' });
    this.bar.stop();
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Global progress bar instance for build tracking
let globalProgressBar: ProgressBar | null = null;

export function createBuildProgressBar(total: number, label = 'Building'): ProgressBar {
  globalProgressBar = new ProgressBar({ total, label });
  return globalProgressBar;
}

export function getBuildProgressBar(): ProgressBar | null {
  return globalProgressBar;
}

export function clearBuildProgressBar(): void {
  if (globalProgressBar) {
    globalProgressBar.stop();
    globalProgressBar = null;
  }
}
