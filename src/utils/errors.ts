import { ExecError } from '../types/BuildTypes';

export type FailurePhase = 'execute' | 'manual' | 'recover';

export interface FailureContext {
  project?: string;
  script?: string;
  command?: string;
  cwd?: string;
  phase: FailurePhase;
}

/**
 * Shape a ZenithCommandError takes after crossing the worker boundary. workerpool
 * copies own enumerable props off the thrown error and rebuilds a plain `Error`
 * on the other side, so `instanceof` is lost but the fields below survive.
 */
export interface SerializedFailure {
  zenithFailure: true;
  message: string;
  stack?: string;
  project?: string;
  script?: string;
  command?: string;
  cwd?: string;
  phase: FailurePhase;
  exitCode?: number;
  signal?: string | number | null;
  stdout?: string;
  stderr?: string;
}

const toText = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value || undefined;
  if (Buffer.isBuffer(value)) return value.toString('utf-8') || undefined;
  return String(value);
};

/**
 * `execSync` builds its message as `Command failed: <cmd>\n<stderr>`. The stderr
 * is reported on its own further down, so drop the duplicate tail.
 */
const stripTrailing = (message: string, suffix: string | undefined): string => {
  if (!suffix) return message.trim();
  const trimmed = message.trim();
  return trimmed.endsWith(suffix.trim()) ? trimmed.slice(0, trimmed.length - suffix.trim().length).trim() : trimmed;
};

export const isExecError = (error: unknown): error is ExecError => (
  error !== null
  && typeof error === 'object'
  && ('stderr' in error || 'stdout' in error)
  && 'status' in error
);

const isSerializedFailure = (error: unknown): error is SerializedFailure => (
  error !== null
  && typeof error === 'object'
  && (error as { zenithFailure?: unknown }).zenithFailure === true
);

export class ZenithCommandError extends Error {
  project?: string;

  script?: string;

  command?: string;

  cwd?: string;

  phase: FailurePhase;

  exitCode?: number;

  signal?: string | number | null;

  stdout?: string;

  stderr?: string;

  /**
   * Marks the payload so it can be recognised after workerpool strips the
   * prototype. Enumerable and own, which is what `convertError` copies.
   */
  zenithFailure = true as const;

  constructor(message: string, details: Omit<SerializedFailure, 'zenithFailure' | 'message' | 'stack'>) {
    super(message);
    this.name = 'ZenithCommandError';
    this.project = details.project;
    this.script = details.script;
    this.command = details.command;
    this.cwd = details.cwd;
    this.phase = details.phase;
    this.exitCode = details.exitCode;
    this.signal = details.signal;
    this.stdout = details.stdout;
    this.stderr = details.stderr;
  }

  static fromSerialized(payload: SerializedFailure): ZenithCommandError {
    const error = new ZenithCommandError(payload.message, payload);
    if (payload.stack) error.stack = payload.stack;
    return error;
  }
}

/**
 * Wraps whatever the worker threw into a ZenithCommandError, keeping the child
 * process' exit code and captured output so the failure can be reported in full.
 */
export const toZenithCommandError = (error: unknown, context: FailureContext): ZenithCommandError => {
  if (error instanceof ZenithCommandError) return error;
  if (isSerializedFailure(error)) return ZenithCommandError.fromSerialized(error);

  if (isExecError(error)) {
    const stderr = toText(error.stderr);
    const failure = new ZenithCommandError(stripTrailing(error.message, stderr), {
      ...context,
      exitCode: typeof error.status === 'number' ? error.status : undefined,
      signal: error.signal ?? null,
      stdout: toText(error.stdout),
      stderr
    });
    if (error.stack) failure.stack = error.stack;
    return failure;
  }

  const message = error instanceof Error ? error.message : String(error);
  const failure = new ZenithCommandError(message, context);
  if (error instanceof Error && error.stack) failure.stack = error.stack;
  return failure;
};

/** Rehydrates an error that came back through workerpool, tagging it with caller context. */
export const fromWorkerError = (error: unknown, context: FailureContext): ZenithCommandError => {
  const failure = toZenithCommandError(error, context);
  failure.project = failure.project || context.project;
  failure.script = failure.script || context.script;
  failure.command = failure.command || context.command;
  failure.cwd = failure.cwd || context.cwd;
  return failure;
};

const PHASE_LABELS: Record<FailurePhase, string> = {
  execute: 'running target',
  manual: 'running command',
  recover: 'recovering cache'
};

/** Single human-readable block describing why the run stopped. */
export const formatFailureBlock = (error: unknown): string => {
  if (!(error instanceof ZenithCommandError) && !isSerializedFailure(error)) {
    const message = error instanceof Error ? (error.stack || error.message) : String(error);
    return `Zenith failed: ${message}`;
  }

  const failure = error instanceof ZenithCommandError ? error : ZenithCommandError.fromSerialized(error);
  const target = failure.project ? `${failure.project}  (target: ${failure.script || 'unknown'})` : failure.script || 'unknown';
  const lines = [`Zenith failed: ${target}`, `  phase    : ${PHASE_LABELS[failure.phase]}`];
  if (failure.command) lines.push(`  command  : ${failure.command}`);
  if (failure.cwd) lines.push(`  cwd      : ${failure.cwd}`);
  if (failure.exitCode !== undefined || failure.signal) {
    lines.push(`  exit code: ${failure.exitCode ?? 'unknown'}   signal: ${failure.signal || 'none'}`);
  }
  lines.push(`  error    : ${failure.message}`);
  if (failure.stdout) lines.push('  --- stdout ---', failure.stdout);
  if (failure.stderr) lines.push('  --- stderr ---', failure.stderr);
  if (!failure.stdout && !failure.stderr && failure.stack) lines.push('  --- stack ---', failure.stack);
  return lines.join('\n');
};
