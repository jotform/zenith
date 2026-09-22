import { createNoSuchKeyError, isCacheMissError } from '../src/utils/errors';

describe('isCacheMissError', () => {
  test('detects AWS-style 404 metadata', () => {
    expect(isCacheMissError({ $metadata: { httpStatusCode: 404 } })).toBe(true);
  });

  test('detects NoSuchKey by name / code', () => {
    expect(isCacheMissError({ name: 'NoSuchKey' })).toBe(true);
    expect(isCacheMissError({ code: 'NoSuchKey' })).toBe(true);
    expect(isCacheMissError({ Code: 'NoSuchKey' })).toBe(true);
  });

  test('detects createNoSuchKeyError()', () => {
    const err = createNoSuchKeyError({
      code: 'NoSuchKey',
      message: 'The specified key does not exist.',
      key: 'build/hash/pkg/out.zip',
      httpStatusCode: 404,
    });
    expect(err.name).toBe('NoSuchKey');
    expect(isCacheMissError(err)).toBe(true);
  });

  test('ignores unrelated errors', () => {
    expect(isCacheMissError({ $metadata: { httpStatusCode: 500 } })).toBe(false);
    expect(isCacheMissError(new Error('Command failed'))).toBe(false);
    expect(isCacheMissError(null)).toBe(false);
  });
});
