#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const {
  S3, ListObjectsV2Command, DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');

const ROOT = process.cwd();
const BUCKET = process.env.S3_BUCKET_NAME || 'zenith-cache';
const TARGET = 'bench';
const OUTPUT = 'dist';

const MB = 1024 * 1024;

const nowMs = () => Number(process.hrtime.bigint()) / 1e6;

const makeS3 = () => new S3({
  endpoint: process.env.S3_ENDPOINT || 'http://127.0.0.1:9000',
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
});

const hashText = (seed, bytes) => {
  let out = '';
  let i = 0;
  while (out.length < bytes) {
    out += crypto.createHash('sha256').update(`${seed}-${i}`).digest('hex');
    i += 1;
  }
  return out.slice(0, bytes);
};

const hashBuffer = (seed, bytes) => {
  const chunks = [];
  let produced = 0;
  let i = 0;
  while (produced < bytes) {
    const block = crypto.createHash('sha256').update(`${seed}-${i}`).digest();
    chunks.push(block);
    produced += block.length;
    i += 1;
  }
  return Buffer.concat(chunks).subarray(0, bytes);
};

const clearBucket = async (s3) => {
  while (true) {
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET }));
    const keys = (listed.Contents || []).map((item) => ({ Key: item.Key }));
    if (keys.length === 0) break;
    await s3.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: keys, Quiet: true },
    }));
    if (!listed.IsTruncated) break;
  }
};

const countObjectsWithPrefix = async (s3, prefix) => {
  let count = 0;
  let continuationToken;
  while (true) {
    const listed = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    count += (listed.Contents || []).length;
    if (!listed.IsTruncated) break;
    continuationToken = listed.NextContinuationToken;
  }
  return count;
};

const scenarios = [
  {
    name: 'many-small-text',
    async generate(outputDir) {
      await fs.mkdir(outputDir, { recursive: true });
      for (let i = 0; i < 2000; i += 1) {
        const sub = `group-${String(i % 20).padStart(2, '0')}`;
        const dir = path.join(outputDir, sub);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, `file-${String(i).padStart(4, '0')}.txt`), hashText(`small-${i}`, 2048));
      }
    },
  },
  {
    name: 'few-large-binary',
    async generate(outputDir) {
      await fs.mkdir(outputDir, { recursive: true });
      for (let i = 0; i < 4; i += 1) {
        await fs.writeFile(path.join(outputDir, `blob-${i}.bin`), hashBuffer(`blob-${i}`, 16 * MB));
      }
    },
  },
  {
    name: 'mixed-content',
    async generate(outputDir) {
      await fs.mkdir(path.join(outputDir, 'texts'), { recursive: true });
      await fs.mkdir(path.join(outputDir, 'json', 'nested'), { recursive: true });
      await fs.mkdir(path.join(outputDir, 'bin'), { recursive: true });
      await fs.mkdir(path.join(outputDir, 'empty'), { recursive: true });

      for (let i = 0; i < 500; i += 1) {
        await fs.writeFile(path.join(outputDir, 'texts', `t-${i}.md`), `# Title ${i}\n${hashText(`md-${i}`, 1024)}\n`);
      }
      for (let i = 0; i < 150; i += 1) {
        const obj = { id: i, ok: i % 2 === 0, payload: hashText(`json-${i}`, 512) };
        await fs.writeFile(path.join(outputDir, 'json', 'nested', `j-${i}.json`), JSON.stringify(obj));
      }
      for (let i = 0; i < 20; i += 1) {
        await fs.writeFile(path.join(outputDir, 'bin', `b-${i}.dat`), hashBuffer(`mix-bin-${i}`, MB));
      }
      for (let i = 0; i < 120; i += 1) {
        await fs.writeFile(path.join(outputDir, 'empty', `e-${i}.txt`), '');
      }
      await fs.writeFile(path.join(outputDir, 'unicode.txt'), 'Merhaba dunya\nGrusse\nこんにちは\n');
    },
  },
];

const run = async () => {
  const { default: RemoteCacher } = require('../build/classes/Cache/RemoteCacher');
  const { default: Hasher } = require('../build/classes/Hasher');
  const { configManagerInstance, CACHE_FORMATS } = require('../build/config');
  const s3 = makeS3();
  const hasher = new Hasher();
  const benchmarkRoot = path.join(ROOT, 'tmp-cache-bench');

  await fs.rm(benchmarkRoot, { recursive: true, force: true });
  await fs.mkdir(benchmarkRoot, { recursive: true });

  const report = [];

  for (const scenario of scenarios) {
    const scenarioRoot = `tmp-cache-bench/${scenario.name}`;
    const scenarioDir = path.join(ROOT, scenarioRoot);
    const outputDir = path.join(scenarioDir, OUTPUT);

    await fs.rm(scenarioDir, { recursive: true, force: true });
    await scenario.generate(outputDir);
    const originalHash = await hasher.getHash(outputDir);

    const scenarioResult = { scenario: scenario.name, formats: [] };
    const formatOrder = [
      CACHE_FORMATS.ZIP,
      CACHE_FORMATS.FILES,
      CACHE_FORMATS.TAR,
      CACHE_FORMATS.BLOBS,
      CACHE_FORMATS.AUTO,
    ];
    for (const format of formatOrder) {
      await clearBucket(s3);
      configManagerInstance.updateConfig({ ZENITH_CACHE_FORMAT: format });
      const cacher = new RemoteCacher();
      const hashKey = `hash-${scenario.name}-${format}`;
      const prefix = `${TARGET}/${hashKey}/${scenarioRoot}/`;

      const cacheStart = nowMs();
      await cacher.cache(hashKey, scenarioRoot, OUTPUT, TARGET, '', []);
      const cacheMs = nowMs() - cacheStart;

      const objectCount = await countObjectsWithPrefix(s3, prefix);

      await fs.rm(outputDir, { recursive: true, force: true });
      await fs.mkdir(scenarioDir, { recursive: true });

      const recoverStart = nowMs();
      const recoveredHash = await cacher.recoverFromCache(hashKey, scenarioRoot, OUTPUT, TARGET, true);
      const recoverMs = nowMs() - recoverStart;
      const restoredHash = await hasher.getHash(outputDir);

      scenarioResult.formats.push({
        format,
        cacheMs: Number(cacheMs.toFixed(2)),
        recoverMs: Number(recoverMs.toFixed(2)),
        objectCount,
        recoveredHash,
        restoredHash,
        equalsOriginal: restoredHash === originalHash,
      });
    }
    report.push(scenarioResult);
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
