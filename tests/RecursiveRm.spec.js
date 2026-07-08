import { rm, mkdir, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RECURSIVE_RM_OPTIONS } from '../build/utils/constants';

// Shared options for recursive deletes on the cache recovery path. On macOS,
// fs.rm's recursive teardown races with Finder/Spotlight recreating .DS_Store in
// the directory, so the final rmdir can see a non-empty dir and throw ENOTEMPTY;
// Node retries ENOTEMPTY/EBUSY/EPERM when maxRetries/retryDelay are set. The race
// itself is timing-dependent (proven out-of-suite); here we guard deterministically
// that the retry fields are present and that recursive+force actually clears a tree.
describe('RECURSIVE_RM_OPTIONS', () => {
  let dir;

  beforeEach(() => {
    dir = path.join(os.tmpdir(), `zenith-rm-${process.pid}-${Math.floor(Math.random() * 1e9)}`);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 20 }).catch(() => {});
  });

  it('carries the retry fields that make fs.rm absorb ENOTEMPTY', () => {
    expect(RECURSIVE_RM_OPTIONS.recursive).toBe(true);
    expect(RECURSIVE_RM_OPTIONS.force).toBe(true);
    expect(RECURSIVE_RM_OPTIONS.maxRetries).toBeGreaterThanOrEqual(1);
    expect(RECURSIVE_RM_OPTIONS.retryDelay).toBeGreaterThanOrEqual(1);
  });

  it('recursively removes a populated nested directory (incl. .DS_Store)', async () => {
    await mkdir(path.join(dir, 'static', 'chunks'), { recursive: true });
    await writeFile(path.join(dir, '.DS_Store'), 'x');
    await writeFile(path.join(dir, 'static', '.DS_Store'), 'x');
    await writeFile(path.join(dir, 'static', 'chunks', 'app.js'), 'y');

    await expect(rm(dir, RECURSIVE_RM_OPTIONS)).resolves.toBeUndefined();
    expect(existsSync(dir)).toBe(false);
  });

  it('force:true makes removing a missing path a no-op (no ENOENT)', async () => {
    await expect(rm(dir, RECURSIVE_RM_OPTIONS)).resolves.toBeUndefined();
    await expect(stat(dir)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
