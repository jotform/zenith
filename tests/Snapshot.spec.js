import * as path from 'path';
import {
  writeFileSync, existsSync, mkdirSync, rmSync, readFileSync
} from 'fs';
import { Hasher } from '../src/classes/Hasher';
import {
  writeZenithSnapshot,
  readZenithSnapshot,
  workspaceMapToRecord,
  workspaceRecordToMap,
} from '../src/classes/Merkle/snapshot';

const root = path.join(__dirname, 'mocks-snapshot');
const snapDir = path.join(__dirname, 'mocks-snapshot-meta');

describe('zenith snapshot share across processes', () => {
  beforeEach(() => {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    if (existsSync(snapDir)) rmSync(snapDir, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    mkdirSync(snapDir, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    if (existsSync(snapDir)) rmSync(snapDir, { recursive: true, force: true });
  });

  it('export then import yields same digest and reuses leaves', async () => {
    writeFileSync(path.join(root, 'a.js'), 'export const a = 1;');
    mkdirSync(path.join(root, 'nested'));
    writeFileSync(path.join(root, 'nested', 'b.js'), 'export const b = 2;');

    const hasherA = new Hasher();
    const digestA = await hasherA.getHash(root, 'build', false, undefined, undefined, []);
    const workspace = new Map([['@demo/pkg', new Set(['@demo/dep'])]]);
    const snapPath = path.join(snapDir, 'snap.json');
    writeZenithSnapshot(snapPath, {
      version: 'm1',
      target: 'build',
      createdAt: new Date().toISOString(),
      workspace: workspaceMapToRecord(workspace),
      merkle: hasherA.merkleIndex.serialize(),
      projectHashes: { '@demo/pkg': digestA },
    });

    const loaded = readZenithSnapshot(snapPath);
    expect(Object.keys(loaded.workspace)).toEqual(['@demo/pkg']);
    const restoredWorkspace = workspaceRecordToMap(loaded.workspace);
    expect(restoredWorkspace.get('@demo/pkg').has('@demo/dep')).toBe(true);

    const hasherB = new Hasher();
    hasherB.merkleIndex.deserialize(loaded.merkle);
    hasherB.resetPerfCounters();
    const digestB = await hasherB.getHash(root, 'build', false, undefined, undefined, []);
    const perf = hasherB.getPerfCounters();
    expect(digestB).toBe(digestA);
    expect(perf.filesHashed).toBe(0);
    expect(perf.filesReused).toBe(2);
    expect(perf.bytesRead).toBe(0);
    expect(JSON.parse(readFileSync(snapPath, 'utf8')).version).toBe('m1');
  });
});
