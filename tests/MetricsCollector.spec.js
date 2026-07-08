import { Readable } from 'stream';
import * as path from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { metricsCollector } from '../src/metrics/MetricsCollector';
import { countReadable } from '../src/utils/stream';
import { decorateCacherWithMetrics } from '../src/classes/Cache/metrics/cacherMetricsDecorator';
import { recordOutputStats } from '../src/classes/Cache/metrics/recordOutputStats';
import { ROOT_PATH } from '../src/utils/constants';

const drain = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

describe('metricsCollector', () => {
  beforeEach(() => metricsCollector.reset());

  it('accumulates uploads and downloads and resets', () => {
    metricsCollector.addUpload(10, 100);
    metricsCollector.addUpload(5, 50);
    metricsCollector.addDownload(20, 200);
    expect(metricsCollector.snapshot()).toEqual({
      uploadMs: 15, uploadBytes: 150, downloadMs: 20, downloadBytes: 200,
    });
    metricsCollector.reset();
    expect(metricsCollector.snapshot()).toEqual({});
  });

  it('derives transfer wall span from the union of (possibly overlapping) windows', () => {
    // Two overlapping uploads: [100,160] and [120,200]. Summed durations = 60+80 = 140,
    // but the real wall span is 200-100 = 100. The window must report the span, not the sum.
    metricsCollector.noteUploadWindow(100, 160);
    metricsCollector.noteUploadWindow(120, 200);
    expect(metricsCollector.getUploadWallMs()).toBe(100);

    metricsCollector.noteDownloadWindow(50, 90);
    metricsCollector.noteDownloadWindow(70, 130);
    expect(metricsCollector.getDownloadWallMs()).toBe(80);

    metricsCollector.reset();
    expect(metricsCollector.getUploadWallMs()).toBe(0);
    expect(metricsCollector.getDownloadWallMs()).toBe(0);
  });

});

describe('countReadable', () => {
  it('counts bytes flowing through and preserves content', async () => {
    let counted = -1;
    const source = Readable.from([Buffer.from('hello'), Buffer.from('world!')]);
    const counting = countReadable(source, (bytes) => { counted = bytes; });
    const content = await drain(counting);
    expect(content.toString()).toBe('helloworld!');
    expect(counted).toBe(11);
  });
});

describe('decorateCacherWithMetrics', () => {
  const makeFakeCacher = () => {
    const objects = new Map();
    return {
      objects,
      async putObject({ Key, Body }) {
        objects.set(Key, typeof Body === 'string' || Buffer.isBuffer(Body) ? Buffer.from(Body) : await drain(Body));
      },
      async getObject({ Key }) {
        return Readable.from(objects.get(Key));
      },
    };
  };

  beforeEach(() => metricsCollector.reset());

  it('counts Buffer, string, and Readable uploads', async () => {
    const cacher = decorateCacherWithMetrics(makeFakeCacher());
    await cacher.putObject({ Key: 'a', Body: Buffer.alloc(100) });
    await cacher.putObject({ Key: 'b', Body: 'xyz' });
    await cacher.putObject({ Key: 'c', Body: Readable.from([Buffer.alloc(7)]) });
    const snap = metricsCollector.snapshot();
    expect(snap.uploadBytes).toBe(110);
    expect(snap.uploadMs).toBeGreaterThanOrEqual(0);
    expect(cacher.objects.get('c').length).toBe(7); // content intact
  });

  it('counts download bytes once the returned stream is consumed', async () => {
    const cacher = decorateCacherWithMetrics(makeFakeCacher());
    await cacher.putObject({ Key: 'a', Body: Buffer.alloc(64) });
    metricsCollector.reset();
    const stream = await cacher.getObject({ Key: 'a' });
    await drain(stream);
    const snap = metricsCollector.snapshot();
    expect(snap.downloadBytes).toBe(64);
    expect(snap.downloadMs).toBeGreaterThanOrEqual(0);
  });
});

describe('recordOutputStats', () => {
  const TMP_ROOT = '.tmp-outputstats';

  beforeEach(() => {
    metricsCollector.reset();
    mkdirSync(path.join(ROOT_PATH, TMP_ROOT, 'proj', 'dist', 'nested'), { recursive: true });
    writeFileSync(path.join(ROOT_PATH, TMP_ROOT, 'proj', 'dist', 'a.js'), 'aaaa'); // 4 bytes
    writeFileSync(path.join(ROOT_PATH, TMP_ROOT, 'proj', 'dist', 'nested', 'b.js'), 'bb'); // 2 bytes
  });

  afterEach(() => {
    rmSync(path.join(ROOT_PATH, TMP_ROOT), { recursive: true, force: true });
  });

  it('walks directory outputs and records bytes and file count', async () => {
    await recordOutputStats(`${TMP_ROOT}/proj`, ['dist'], '');
    expect(metricsCollector.snapshot()).toEqual({ outputBytes: 6, fileCount: 2 });
  });

  it('records stdout outputs as the command output byte length', async () => {
    await recordOutputStats(`${TMP_ROOT}/proj`, ['stdout'], 'hello');
    expect(metricsCollector.snapshot()).toEqual({ outputBytes: 5, fileCount: 0 });
  });

  it('silently skips missing output directories', async () => {
    await recordOutputStats(`${TMP_ROOT}/proj`, ['no-such-dir'], '');
    expect(metricsCollector.snapshot()).toEqual({});
  });
});
