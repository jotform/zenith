import * as path from 'path';
import {
  writeFileSync, existsSync, mkdirSync, rmSync
} from 'fs';
import { Hasher } from '../src/classes/Hasher';
import { generateFileTree, walkFileTree, updateFileContents, randomPick } from './utils';

const mocksFolderPath = path.join(__dirname, 'mocks-perf');

describe('hasher merkle performance', () => {
  const cleanUp = () => {
    if (existsSync(mocksFolderPath)) {
      rmSync(mocksFolderPath, { recursive: true, force: true });
    }
    mkdirSync(mocksFolderPath, { recursive: true });
  };

  beforeEach(cleanUp);

  afterAll(() => {
    if (existsSync(mocksFolderPath)) {
      rmSync(mocksFolderPath, { recursive: true, force: true });
    }
  });

  it('warm index reuses all leaves with zero bytes read', async () => {
    const fileCount = generateFileTree(mocksFolderPath, 4, 4);
    expect(fileCount).toBeGreaterThan(10);

    const hasher = new Hasher();
    await hasher.getHash(mocksFolderPath, 'build', false, undefined, undefined, []);
    const cold = hasher.getPerfCounters();
    expect(cold.filesHashed).toBe(fileCount);
    expect(cold.bytesRead).toBeGreaterThan(0);

    hasher.resetPerfCounters();
    const warmDigest = await hasher.getHash(mocksFolderPath, 'build', false, undefined, undefined, []);
    const warm = hasher.getPerfCounters();
    expect(warmDigest).toMatch(/^m1:[a-f0-9]{64}$/);
    expect(warm.filesReused).toBe(fileCount);
    expect(warm.filesHashed).toBe(0);
    expect(warm.bytesRead).toBe(0);
  });

  it('partial dirty tree only rehashes changed leaves', async () => {
    const fileCount = generateFileTree(mocksFolderPath, 4, 4);
    const hasher = new Hasher();
    await hasher.getHash(mocksFolderPath, 'build', false, undefined, undefined, []);

    const allFiles = walkFileTree(mocksFolderPath);
    const changeCount = Math.max(1, Math.floor(allFiles.length * 0.1));
    const toChange = randomPick(allFiles, changeCount);
    toChange.forEach((filePath) => updateFileContents(filePath));

    hasher.resetPerfCounters();
    await hasher.getHash(mocksFolderPath, 'build', false, undefined, undefined, []);
    const perf = hasher.getPerfCounters();
    expect(perf.filesHashed).toBe(changeCount);
    expect(perf.filesReused).toBe(fileCount - changeCount);
  });
});
