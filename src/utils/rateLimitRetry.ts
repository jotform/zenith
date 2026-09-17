import Logger from './logger';

const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 32_000;

export type RateLimitRetryOptions = {
  /** Total attempts including the first try. */
  maxAttempts?: number;
  /** Base delay before the first retry; doubles each attempt. */
  baseDelayMs?: number;
  /** Cap for computed backoff (Retry-After may still exceed this). */
  maxDelayMs?: number;
  /** Optional label for log lines (e.g. putObject key). */
  label?: string;
  sleep?: (ms: number) => Promise<void>;
};

const RATE_LIMIT_CODES = new Set([
  'SlowDown',
  'TooManyRequests',
  'TooManyRequestsException',
  'Throttling',
  'ThrottlingException',
  'ThrottledException',
  'RequestLimitExceeded',
  'RequestThrottled',
  'RequestThrottledException',
  'BandwidthLimitExceeded',
]);

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => {
  setTimeout(resolve, ms);
});

const asRecord = (error: unknown): Record<string, unknown> | undefined => {
  if (error != null && typeof error === 'object') return error as Record<string, unknown>;
  return undefined;
};

const readHttpStatus = (error: unknown): number | undefined => {
  const err = asRecord(error);
  if (!err) return undefined;
  const metadata = asRecord(err.$metadata);
  const status = metadata?.httpStatusCode;
  return typeof status === 'number' ? status : undefined;
};

const readErrorCode = (error: unknown): string | undefined => {
  const err = asRecord(error);
  if (!err) return undefined;
  for (const key of ['name', 'Code', 'code', 'ErrorCode']) {
    const value = err[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
};

/** Prefer Retry-After when the backend sends it (common on GCS 429). */
export const getRetryAfterMs = (error: unknown): number | undefined => {
  const err = asRecord(error);
  if (!err) return undefined;
  const response = asRecord(err.$response);
  const headers = asRecord(response?.headers) ?? asRecord(err.headers);
  if (!headers) return undefined;
  const raw = headers['retry-after'] ?? headers['Retry-After'];
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const asSeconds = Number(raw);
  if (!Number.isNaN(asSeconds) && asSeconds >= 0) return asSeconds * 1000;
  const asDate = Date.parse(String(raw));
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return undefined;
};

export const isRateLimitError = (error: unknown): boolean => {
  if (readHttpStatus(error) === 429) return true;
  const code = readErrorCode(error);
  if (code && RATE_LIMIT_CODES.has(code)) return true;
  if (typeof error === 'string') {
    return /rate.?limit|too many requests|slow\s*down/i.test(error);
  }
  if (!(error instanceof Error)) return false;
  return /rate.?limit|too many requests|slow\s*down/i.test(error.message);
};

const resolveRetryOptions = (options: RateLimitRetryOptions = {}) => {
  const fromEnv = (name: string, fallback: number): number => {
    const raw = process.env[name];
    if (raw == null || raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    maxAttempts: options.maxAttempts
      ?? fromEnv('S3_RETRY_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS),
    baseDelayMs: options.baseDelayMs
      ?? fromEnv('S3_RETRY_BASE_DELAY_MS', DEFAULT_BASE_DELAY_MS),
    maxDelayMs: options.maxDelayMs
      ?? fromEnv('S3_RETRY_MAX_DELAY_MS', DEFAULT_MAX_DELAY_MS),
    label: options.label,
    sleep: options.sleep ?? defaultSleep,
  };
};

const computeDelayMs = (
  attemptIndex: number,
  error: unknown,
  baseDelayMs: number,
  maxDelayMs: number,
): number => {
  const retryAfter = getRetryAfterMs(error);
  if (retryAfter != null) return Math.min(Math.max(retryAfter, baseDelayMs), maxDelayMs * 2);
  const exponential = baseDelayMs * (2 ** attemptIndex);
  const jitter = Math.floor(Math.random() * baseDelayMs);
  return Math.min(exponential + jitter, maxDelayMs);
};

/**
 * Retries only on HTTP 429 / S3 SlowDown / related throttling errors, with
 * exponential backoff (honors Retry-After when present).
 */
export const withRateLimitRetry = async <T>(
  operation: () => Promise<T>,
  options: RateLimitRetryOptions = {},
): Promise<T> => {
  const {
    maxAttempts, baseDelayMs, maxDelayMs, label, sleep,
  } = resolveRetryOptions(options);
  const attempts = Math.max(1, Math.floor(maxAttempts));
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const remaining = attempts - attempt - 1;
      if (remaining <= 0 || !isRateLimitError(error)) throw error;

      const delayMs = computeDelayMs(attempt, error, baseDelayMs, maxDelayMs);
      const where = label ? ` for ${label}` : '';
      Logger.log(
        2,
        `Rate limited (429/SlowDown)${where}; sleeping ${delayMs}ms then retry `
          + `${attempt + 2}/${attempts}`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
};
