import {
  isRateLimitError,
  getRetryAfterMs,
  withRateLimitRetry,
} from '../src/utils/rateLimitRetry';

describe('rateLimitRetry', () => {
  const rateLimitError = (overrides = {}) => {
    const err = new Error('Too Many Requests');
    Object.assign(err, {
      name: 'SlowDown',
      $metadata: { httpStatusCode: 429 },
      ...overrides,
    });
    return err;
  };

  describe('isRateLimitError', () => {
    test('detects HTTP 429', () => {
      expect(isRateLimitError({ $metadata: { httpStatusCode: 429 } })).toBe(true);
    });

    test('detects SlowDown / TooManyRequests codes', () => {
      expect(isRateLimitError({ name: 'SlowDown' })).toBe(true);
      expect(isRateLimitError({ Code: 'TooManyRequests' })).toBe(true);
      expect(isRateLimitError({ code: 'RequestLimitExceeded' })).toBe(true);
    });

    test('ignores unrelated errors', () => {
      expect(isRateLimitError({ $metadata: { httpStatusCode: 404 } })).toBe(false);
      expect(isRateLimitError(new Error('NoSuchKey'))).toBe(false);
      expect(isRateLimitError(null)).toBe(false);
    });
  });

  describe('getRetryAfterMs', () => {
    test('reads Retry-After seconds from $response.headers', () => {
      expect(getRetryAfterMs({
        $response: { headers: { 'retry-after': '3' } },
      })).toBe(3000);
    });

    test('returns undefined when header is missing', () => {
      expect(getRetryAfterMs({ $metadata: { httpStatusCode: 429 } })).toBeUndefined();
    });
  });

  describe('withRateLimitRetry', () => {
    test('returns on first success', async () => {
      const sleeps = [];
      const result = await withRateLimitRetry(async () => 'ok', {
        sleep: async (ms) => { sleeps.push(ms); },
      });
      expect(result).toBe('ok');
      expect(sleeps).toEqual([]);
    });

    test('retries 429 with sleep then succeeds', async () => {
      let calls = 0;
      const sleeps = [];
      const result = await withRateLimitRetry(async () => {
        calls += 1;
        if (calls < 3) throw rateLimitError();
        return 'recovered';
      }, {
        maxAttempts: 5,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        sleep: async (ms) => { sleeps.push(ms); },
      });
      expect(result).toBe('recovered');
      expect(calls).toBe(3);
      expect(sleeps).toHaveLength(2);
      expect(sleeps[0]).toBeGreaterThanOrEqual(100);
      expect(sleeps[1]).toBeGreaterThanOrEqual(100);
    });

    test('does not retry non-rate-limit errors', async () => {
      let calls = 0;
      await expect(withRateLimitRetry(async () => {
        calls += 1;
        throw new Error('boom');
      }, {
        maxAttempts: 5,
        sleep: async () => {},
      })).rejects.toThrow('boom');
      expect(calls).toBe(1);
    });

    test('exhausts attempts and rethrows the last 429', async () => {
      let calls = 0;
      const err = rateLimitError();
      await expect(withRateLimitRetry(async () => {
        calls += 1;
        throw err;
      }, {
        maxAttempts: 3,
        baseDelayMs: 10,
        maxDelayMs: 50,
        sleep: async () => {},
      })).rejects.toBe(err);
      expect(calls).toBe(3);
    });

    test('honors Retry-After for delay', async () => {
      const sleeps = [];
      let calls = 0;
      await withRateLimitRetry(async () => {
        calls += 1;
        if (calls === 1) {
          throw rateLimitError({
            $response: { headers: { 'retry-after': '2' } },
          });
        }
        return true;
      }, {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        sleep: async (ms) => { sleeps.push(ms); },
      });
      expect(sleeps[0]).toBe(2000);
    });
  });
});
