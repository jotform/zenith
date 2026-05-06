import * as path from 'path';
import {
  mkdtempSync, writeFileSync, rmSync, existsSync,
} from 'fs';
import { mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import { Hasher } from '../src/classes/Hasher';
import ZipCacheFormat from '../src/classes/Cache/cacheFormats/zipFormat';
import TarCacheFormat from '../src/classes/Cache/cacheFormats/tarFormat';
import FilesCacheFormat from '../src/classes/Cache/cacheFormats/filesFormat';
import BlobsCacheFormat from '../src/classes/Cache/cacheFormats/blobsFormat';

const bodyToBuffer = async (Body) => {
  if (typeof Body === 'string') return Buffer.from(Body);
  if (Buffer.isBuffer(Body)) return Body;
  if (Body != null && typeof Body[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of Body) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    Body.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    Body.on('error', reject);
    Body.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

class InMemoryObjectStore {
  constructor() {
    this.objects = new Map();
  }

  async putObject({ Key, Body }) {
    this.objects.set(Key, await bodyToBuffer(Body));
  }

  async getObject({ Key }) {
    const stored = this.objects.get(Key);
    if (!stored) {
      throw { $metadata: { httpStatusCode: 404 } };
    }
    return Readable.from(stored);
  }

  async txtPipeEnd(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}

const FORMATS = [
  ['zip', ZipCacheFormat],
  ['tar', TarCacheFormat],
  ['files', FilesCacheFormat],
  ['blobs', BlobsCacheFormat],
];

describe('cache formats', () => {
  let testRoot = '';

  beforeEach(() => {
    testRoot = mkdtempSync(path.join(tmpdir(), 'zenith-cache-formats-'));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it.each(FORMATS)('%s: cache + recover preserves directory hash and files', async (label, Format) => {
    const outputDir = path.join(testRoot, 'dist-out');
    await mkdir(path.join(outputDir, 'nested'), { recursive: true });
    writeFileSync(path.join(outputDir, 'main.js'), `main-${label}`);
    writeFileSync(path.join(outputDir, 'nested', 'asset.txt'), `asset-${label}`);

    const store = new InMemoryObjectStore();
    const hasher = new Hasher();
    const format = new Format({
      putObject: store.putObject.bind(store),
      getObject: store.getObject.bind(store),
      txtPipeEnd: store.txtPipeEnd.bind(store),
      hasher,
      getBucketName: () => 'test-bucket',
    });

    const cachePath = 'build/hash/sample-project';
    const output = 'dist';
    await format.cacheDirectory({ cachePath, output, directoryPath: outputDir });

    const recoverDir = path.join(testRoot, 'recovered');
    const recoveredHash = await format.recoverDirectory({
      cachePath,
      output,
      outputPath: recoverDir,
    });
    const originalHash = await hasher.getHash(outputDir);

    expect(recoveredHash).toBe(originalHash);
    expect(existsSync(path.join(recoverDir, 'main.js'))).toBe(true);
    expect(existsSync(path.join(recoverDir, 'nested', 'asset.txt'))).toBe(true);
  });

  it.each(FORMATS)('%s: recover returns Cache not found when nothing was cached', async (label, Format) => {
    const store = new InMemoryObjectStore();
    const format = new Format({
      putObject: store.putObject.bind(store),
      getObject: store.getObject.bind(store),
      txtPipeEnd: store.txtPipeEnd.bind(store),
      hasher: new Hasher(),
      getBucketName: () => 'test-bucket',
    });
    const result = await format.recoverDirectory({
      cachePath: 'missing/cache',
      output: 'dist',
      outputPath: path.join(testRoot, `no-output-${label}`),
    });

    expect(result).toBe('Cache not found');
  });
});
