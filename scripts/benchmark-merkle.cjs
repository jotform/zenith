#!/usr/bin/env node
/**
 * Merkle hasher micro-benchmark: cold vs warm vs partial dirty.
 * Usage: pnpm build && node scripts/benchmark-merkle.cjs
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = process.cwd();
const TREE = path.join(ROOT, 'tests', 'mocks-bench-merkle');

const nowMs = () => Number(process.hrtime.bigint()) / 1e6;

const rmrf = (p) => {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
};

const genStr = (size) => {
  let out = '';
  while (out.length < size) out += Math.random().toString(36).slice(2);
  return out.slice(0, size);
};

const generateFileTree = (prefix, depth, fanout) => {
  if (depth === 0) return 0;
  let n = 0;
  for (let i = 0; i < fanout; i += 1) {
    if (Math.random() > 0.45) {
      const fp = path.join(prefix, `f_${depth}_${i}_${genStr(8)}.js`);
      fs.writeFileSync(fp, genStr(200 + (i % 5) * 100));
      n += 1;
    } else {
      const dir = path.join(prefix, `d_${depth}_${i}_${genStr(6)}`);
      fs.mkdirSync(dir, { recursive: true });
      n += generateFileTree(dir, depth - 1, fanout);
    }
  }
  return n;
};

const walkFiles = (dir) => {
  let results = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) results = results.concat(walkFiles(full));
    else results.push(full);
  }
  return results;
};

const printRow = (label, ms, perf, digest) => {
  // eslint-disable-next-line no-console
  console.log(
    `${label.padEnd(14)} ${ms.toFixed(1).padStart(8)}ms  hashed=${String(perf.filesHashed).padStart(5)}  reused=${String(perf.filesReused).padStart(5)}  bytes=${String(perf.bytesRead).padStart(10)}  ${digest.slice(0, 20)}…`,
  );
};

const main = async () => {
  const hasherMod = await import(pathToFileURL(path.join(ROOT, 'build', 'classes', 'Hasher.js')).href);
  const snapshotMod = await import(pathToFileURL(path.join(ROOT, 'build', 'classes', 'Merkle', 'snapshot.js')).href);
  const { Hasher } = hasherMod;
  const { writeZenithSnapshot, readZenithSnapshot, workspaceRecordToMap } = snapshotMod;

  rmrf(TREE);
  fs.mkdirSync(TREE, { recursive: true });
  const fileCount = generateFileTree(TREE, 5, 5);
  // eslint-disable-next-line no-console
  console.log(`Synthetic tree: ${fileCount} files under ${TREE}\n`);

  const hasher = new Hasher();
  let t0 = nowMs();
  let digest = await hasher.getHash(TREE, 'bench', false, undefined, undefined, []);
  printRow('cold', nowMs() - t0, hasher.getPerfCounters(), digest);

  hasher.resetPerfCounters();
  t0 = nowMs();
  digest = await hasher.getHash(TREE, 'bench', false, undefined, undefined, []);
  printRow('warm', nowMs() - t0, hasher.getPerfCounters(), digest);

  const files = walkFiles(TREE);
  const dirtyN = Math.max(1, Math.floor(files.length * 0.01));
  for (let i = 0; i < dirtyN; i += 1) {
    fs.appendFileSync(files[i], `\n// dirty ${i}`);
  }
  hasher.resetPerfCounters();
  t0 = nowMs();
  digest = await hasher.getHash(TREE, 'bench', false, undefined, undefined, []);
  printRow(`dirty ${dirtyN}`, nowMs() - t0, hasher.getPerfCounters(), digest);

  const snapPath = path.join(ROOT, 'tests', 'mocks-bench-merkle-snap.json');
  if (fs.existsSync(snapPath)) fs.unlinkSync(snapPath);
  writeZenithSnapshot(snapPath, {
    version: 'm1',
    target: 'bench',
    createdAt: new Date().toISOString(),
    workspace: { 'bench-pkg': [] },
    merkle: hasher.merkleIndex.serialize(),
    projectHashes: { 'bench-pkg': digest },
  });

  const imported = readZenithSnapshot(snapPath);
  const hasher2 = new Hasher();
  hasher2.merkleIndex.deserialize(imported.merkle);
  workspaceRecordToMap(imported.workspace);
  hasher2.resetPerfCounters();
  t0 = nowMs();
  digest = await hasher2.getHash(TREE, 'bench', false, undefined, undefined, []);
  printRow('import-warm', nowMs() - t0, hasher2.getPerfCounters(), digest);

  rmrf(TREE);
  if (fs.existsSync(snapPath)) fs.unlinkSync(snapPath);
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
