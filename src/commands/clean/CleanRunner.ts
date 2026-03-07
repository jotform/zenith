import { existsSync, rmSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';

export interface CleanRunnerOptions {
  all?: boolean;
  dryRun?: boolean;
  project?: string;
}

export class CleanRunner {
  protected all = false;
  protected dryRun = false;
  protected project?: string;
  protected cachePath = '.zenith-cache';

  constructor(options: CleanRunnerOptions = {}) {
    this.all = options.all ?? false;
    this.dryRun = options.dryRun ?? false;
    this.project = options.project;
  }

  async run(): Promise<void> {
    const rootPath = process.cwd();
    
    // Try to get cache path from zenith.json
    const configPath = join(rootPath, 'zenith.json');
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'));
        if (config.buildConfig?.cachePath) {
          this.cachePath = config.buildConfig.cachePath;
        }
      } catch (e) {
        // Use default cache path
      }
    }

    const fullCachePath = join(rootPath, this.cachePath);

    if (!existsSync(fullCachePath)) {
      console.log(`✅ Cache directory does not exist: ${this.cachePath}`);
      console.log('   Nothing to clean.');
      return;
    }

    if (this.all) {
      // Clean entire cache directory
      await this.cleanDirectory(fullCachePath, 'entire cache');
    } else if (this.project) {
      // Clean specific project cache
      const projectCachePath = join(fullCachePath, this.project);
      if (existsSync(projectCachePath)) {
        await this.cleanDirectory(projectCachePath, `project "${this.project}"`);
      } else {
        console.log(`⚠️  No cache found for project: ${this.project}`);
      }
    } else {
      // Show cache info and clean with confirmation
      await this.showCacheInfo(fullCachePath);
      await this.cleanDirectory(fullCachePath, 'entire cache');
    }
  }

  private async showCacheInfo(cachePath: string): Promise<void> {
    try {
      const items = readdirSync(cachePath);
      const stats = this.getCacheStats(cachePath);
      
      console.log('📊 Cache Statistics:');
      console.log(`   Path: ${this.cachePath}`);
      console.log(`   Projects: ${items.length}`);
      console.log(`   Total size: ${this.formatBytes(stats.totalSize)}`);
      console.log(`   Files: ${stats.fileCount}`);
      console.log('');
    } catch (e) {
      // Ignore errors when showing info
    }
  }

  private getCacheStats(dirPath: string): { totalSize: number; fileCount: number } {
    let totalSize = 0;
    let fileCount = 0;

    const scan = (currentPath: string) => {
      try {
        const items = readdirSync(currentPath);
        for (const item of items) {
          const itemPath = join(currentPath, item);
          const stat = statSync(itemPath);
          if (stat.isDirectory()) {
            scan(itemPath);
          } else {
            totalSize += stat.size;
            fileCount++;
          }
        }
      } catch (e) {
        // Skip inaccessible directories
      }
    };

    scan(dirPath);
    return { totalSize, fileCount };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async cleanDirectory(dirPath: string, description: string): Promise<void> {
    if (this.dryRun) {
      console.log(`🔍 [DRY RUN] Would delete ${description}: ${dirPath}`);
      return;
    }

    console.log(`🧹 Cleaning ${description}...`);
    try {
      rmSync(dirPath, { recursive: true, force: true });
      console.log(`✅ Successfully cleaned ${description}`);
    } catch (error) {
      console.error(`❌ Failed to clean ${description}:`, error);
      throw error;
    }
  }
}

// CLI wrapper for commander (used as default export)
export default class CleanRunnerCLI extends CleanRunner {
  constructor(...args: readonly string[]) {
    const program = new Command();
    program
      .option('-a, --all', 'Clean all cache without prompting', false)
      .option('-d, --dry-run', 'Show what would be deleted without actually deleting', false)
      .option('-p, --project <name>', 'Clean cache for a specific project');
    program.parse(args);
    const opts = program.opts();
    super({
      all: opts.all as boolean,
      dryRun: opts.dryRun as boolean,
      project: opts.project as string | undefined,
    });
  }
}
