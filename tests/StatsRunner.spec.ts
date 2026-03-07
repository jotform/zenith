import { StatsRunner } from '../src/commands/stats/StatsRunner';
import * as fs from 'fs';
import * as path from 'path';

describe('StatsRunner', () => {
  const testDir = path.join(__dirname, '__stats_test_workspace__');
  const cachePath = path.join(testDir, '.zenith-cache');
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Create test workspace
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(cachePath, 'project1', 'build'), { recursive: true });
    fs.mkdirSync(path.join(cachePath, 'project2', 'test'), { recursive: true });
    
    // Create some cache files
    fs.writeFileSync(path.join(cachePath, 'project1', 'build', 'output.txt'), 'build output');
    fs.writeFileSync(path.join(cachePath, 'project2', 'test', 'results.txt'), 'test results');
    
    // Create zenith.json
    fs.writeFileSync(
      path.join(testDir, 'zenith.json'),
      JSON.stringify({
        projects: {
          'project1': 'packages/project1',
          'project2': 'packages/project2'
        },
        buildConfig: { cachePath: '.zenith-cache' }
      }, null, 2)
    );
    
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should collect statistics for projects', async () => {
    // Capture stdout
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args) => logs.push(args.join(' '));
    
    const runner = new StatsRunner({});
    await runner.run();
    
    console.log = originalLog;
    
    const output = logs.join('\n');
    expect(output).toContain('Zenith Build Statistics');
    expect(output).toContain('Total projects: 2');
  });

  it('should output JSON when --json flag is used', async () => {
    const originalLog = console.log;
    let jsonOutput = '';
    console.log = (output) => { jsonOutput = output; };
    
    const runner = new StatsRunner({ json: true });
    await runner.run();
    
    console.log = originalLog;
    
    const stats = JSON.parse(jsonOutput);
    expect(stats.projects).toHaveLength(2);
    expect(stats.totalFiles).toBeGreaterThan(0);
  });

  it('should show detailed stats with --verbose flag', async () => {
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args) => logs.push(args.join(' '));
    
    const runner = new StatsRunner({ verbose: true });
    await runner.run();
    
    console.log = originalLog;
    
    const output = logs.join('\n');
    expect(output).toContain('Project Details');
    expect(output).toContain('project1');
    expect(output).toContain('project2');
    expect(output).toContain('Cached targets:');
  });

  it('should handle missing zenith.json', async () => {
    fs.unlinkSync(path.join(testDir, 'zenith.json'));
    
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args) => logs.push(args.join(' '));
    
    const runner = new StatsRunner({});
    await runner.run();
    
    console.log = originalLog;
    
    const output = logs.join('\n');
    expect(output).toContain('zenith.json not found');
  });

  it('should handle empty cache', async () => {
    // Remove cache
    fs.rmSync(cachePath, { recursive: true, force: true });
    
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args) => logs.push(args.join(' '));
    
    const runner = new StatsRunner({});
    await runner.run();
    
    console.log = originalLog;
    
    const output = logs.join('\n');
    expect(output).toContain('Total cache size: 0 Bytes');
  });
});
