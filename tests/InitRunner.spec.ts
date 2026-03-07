import { InitRunner } from '../src/commands/init/InitRunner';
import * as fs from 'fs';
import * as path from 'path';

describe('InitRunner', () => {
  const testDir = path.join(__dirname, '__test_workspace__');
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Create test workspace
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, 'packages', 'app1'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'packages', 'lib1'), { recursive: true });
    
    // Create package.json files
    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test-monorepo',
        workspaces: ['packages/*']
      }, null, 2)
    );
    fs.writeFileSync(
      path.join(testDir, 'packages', 'app1', 'package.json'),
      JSON.stringify({ name: '@test/app1' }, null, 2)
    );
    fs.writeFileSync(
      path.join(testDir, 'packages', 'lib1', 'package.json'),
      JSON.stringify({ name: '@test/lib1' }, null, 2)
    );
    
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    // Clean up test workspace
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should create zenith.json with detected projects', async () => {
    const runner = new InitRunner({});
    await runner.run();
    
    const configPath = path.join(testDir, 'zenith.json');
    expect(fs.existsSync(configPath)).toBe(true);
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.projects).toHaveProperty('@test/app1');
    expect(config.projects).toHaveProperty('@test/lib1');
    expect(config.projects['@test/app1']).toBe('packages/app1');
    expect(config.projects['@test/lib1']).toBe('packages/lib1');
  });

  it('should include default build config', async () => {
    const runner = new InitRunner({});
    await runner.run();
    
    const configPath = path.join(testDir, 'zenith.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    expect(config.buildConfig).toBeDefined();
    expect(config.buildConfig.cachePath).toBe('.zenith-cache');
    expect(config.buildConfig.appConfig.build).toBeDefined();
    expect(config.buildConfig.appConfig.test).toBeDefined();
    expect(config.buildConfig.appConfig.lint).toBeDefined();
  });

  it('should not overwrite existing config without --force', async () => {
    // Create existing config
    fs.writeFileSync(
      path.join(testDir, 'zenith.json'),
      JSON.stringify({ existing: true }, null, 2)
    );
    
    const runner = new InitRunner({});
    
    // Should throw or exit
    await expect(async () => {
      await runner.run();
    }).rejects.toThrow();
    
    // Original config should be preserved
    const config = JSON.parse(fs.readFileSync(path.join(testDir, 'zenith.json'), 'utf-8'));
    expect(config.existing).toBe(true);
  });

  it('should overwrite existing config with --force', async () => {
    // Create existing config
    fs.writeFileSync(
      path.join(testDir, 'zenith.json'),
      JSON.stringify({ existing: true }, null, 2)
    );
    
    const runner = new InitRunner({ force: true });
    await runner.run();
    
    // Config should be overwritten
    const config = JSON.parse(fs.readFileSync(path.join(testDir, 'zenith.json'), 'utf-8'));
    expect(config.existing).toBeUndefined();
    expect(config.projects).toBeDefined();
  });

  it('should write to custom output path', async () => {
    const runner = new InitRunner({ output: 'custom-config.json' });
    await runner.run();
    
    const customPath = path.join(testDir, 'custom-config.json');
    expect(fs.existsSync(customPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(customPath, 'utf-8'));
    expect(config.projects).toBeDefined();
  });

  it('should detect pnpm workspaces', async () => {
    // Remove npm workspaces and add pnpm
    const rootPkg = JSON.parse(fs.readFileSync(path.join(testDir, 'package.json'), 'utf-8'));
    delete rootPkg.workspaces;
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(rootPkg, null, 2));
    
    fs.writeFileSync(
      path.join(testDir, 'pnpm-workspace.yaml'),
      'packages:\n  - "packages/*"'
    );
    
    const runner = new InitRunner({});
    await runner.run();
    
    const config = JSON.parse(fs.readFileSync(path.join(testDir, 'zenith.json'), 'utf-8'));
    expect(config.projects).toHaveProperty('@test/app1');
    expect(config.projects).toHaveProperty('@test/lib1');
  });
});
