import { CleanRunner } from '../src/commands/clean/CleanRunner';
import * as fs from 'fs';
import * as path from 'path';

describe('CleanRunner', () => {
  const testDir = path.join(__dirname, '__clean_test_workspace__');
  const cachePath = path.join(testDir, '.zenith-cache');
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Create test workspace with cache
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(cachePath, 'project1'), { recursive: true });
    fs.mkdirSync(path.join(cachePath, 'project2'), { recursive: true });
    
    // Create some cache files
    fs.writeFileSync(path.join(cachePath, 'project1', 'cache.txt'), 'cache data 1');
    fs.writeFileSync(path.join(cachePath, 'project2', 'cache.txt'), 'cache data 2');
    
    // Create zenith.json
    fs.writeFileSync(
      path.join(testDir, 'zenith.json'),
      JSON.stringify({
        projects: {},
        buildConfig: { cachePath: '.zenith-cache' }
      }, null, 2)
    );
    
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    // Clean up test workspace
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should clean entire cache with --all flag', async () => {
    expect(fs.existsSync(cachePath)).toBe(true);
    
    const runner = new CleanRunner({ all: true });
    await runner.run();
    
    expect(fs.existsSync(cachePath)).toBe(false);
  });

  it('should show what would be deleted with --dry-run flag', async () => {
    expect(fs.existsSync(cachePath)).toBe(true);
    
    const runner = new CleanRunner({ all: true, dryRun: true });
    await runner.run();
    
    // Cache should still exist after dry run
    expect(fs.existsSync(cachePath)).toBe(true);
    expect(fs.existsSync(path.join(cachePath, 'project1', 'cache.txt'))).toBe(true);
  });

  it('should clean specific project cache with --project flag', async () => {
    const runner = new CleanRunner({ project: 'project1' });
    await runner.run();
    
    // project1 cache should be deleted
    expect(fs.existsSync(path.join(cachePath, 'project1'))).toBe(false);
    // project2 cache should still exist
    expect(fs.existsSync(path.join(cachePath, 'project2'))).toBe(true);
  });

  it('should handle non-existent cache gracefully', async () => {
    // Remove cache first
    fs.rmSync(cachePath, { recursive: true, force: true });
    
    const runner = new CleanRunner({ all: true });
    // Should not throw
    await expect(runner.run()).resolves.not.toThrow();
  });

  it('should handle non-existent project cache gracefully', async () => {
    const runner = new CleanRunner({ project: 'non-existent-project' });
    // Should not throw
    await expect(runner.run()).resolves.not.toThrow();
  });
});
