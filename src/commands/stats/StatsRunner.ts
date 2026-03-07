import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { Command } from 'commander';

interface ProjectStats {
  name: string;
  path: string;
  cacheSize: number;
  cacheFiles: number;
  targets: string[];
}

interface CacheStats {
  totalSize: number;
  totalFiles: number;
  projects: ProjectStats[];
}

export interface StatsRunnerOptions {
  json?: boolean;
  verbose?: boolean;
}

export class StatsRunner {
  protected json = false;
  protected verbose = false;
  protected cachePath = '.zenith-cache';
  protected projects: Record<string, string> = {};

  constructor(options: StatsRunnerOptions = {}) {
    this.json = options.json ?? false;
    this.verbose = options.verbose ?? false;
  }

  async run(): Promise<void> {
    const rootPath = process.cwd();
    
    // Try to get config from zenith.json
    const configPath = join(rootPath, 'zenith.json');
    if (!existsSync(configPath)) {
      if (this.json) {
        console.log(JSON.stringify({ error: 'zenith.json not found' }));
      } else {
        console.log('❌ zenith.json not found. Run `zenith init` to create one.');
      }
      return;
    }

    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (config.buildConfig?.cachePath) {
        this.cachePath = config.buildConfig.cachePath;
      }
      if (config.projects) {
        this.projects = config.projects;
      }
    } catch (e) {
      if (this.json) {
        console.log(JSON.stringify({ error: 'Failed to parse zenith.json' }));
      } else {
        console.error('❌ Failed to parse zenith.json');
      }
      return;
    }

    const stats = this.collectStats(rootPath);
    
    if (this.json) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      this.printStats(stats);
    }
  }

  private collectStats(rootPath: string): CacheStats {
    const fullCachePath = join(rootPath, this.cachePath);
    const projectStats: ProjectStats[] = [];

    for (const [name, projectPath] of Object.entries(this.projects)) {
      const projectCachePath = join(fullCachePath, name);
      const cacheInfo = this.getDirectoryStats(projectCachePath);
      const targets = this.getTargets(projectCachePath);

      projectStats.push({
        name,
        path: projectPath,
        cacheSize: cacheInfo.size,
        cacheFiles: cacheInfo.files,
        targets,
      });
    }

    const totalSize = projectStats.reduce((sum, p) => sum + p.cacheSize, 0);
    const totalFiles = projectStats.reduce((sum, p) => sum + p.cacheFiles, 0);

    return {
      totalSize,
      totalFiles,
      projects: projectStats,
    };
  }

  private getDirectoryStats(dirPath: string): { size: number; files: number } {
    if (!existsSync(dirPath)) {
      return { size: 0, files: 0 };
    }

    let size = 0;
    let files = 0;

    const scan = (currentPath: string) => {
      try {
        const items = readdirSync(currentPath);
        for (const item of items) {
          const itemPath = join(currentPath, item);
          const stat = statSync(itemPath);
          if (stat.isDirectory()) {
            scan(itemPath);
          } else {
            size += stat.size;
            files++;
          }
        }
      } catch (e) {
        // Skip inaccessible directories
      }
    };

    scan(dirPath);
    return { size, files };
  }

  private getTargets(projectCachePath: string): string[] {
    if (!existsSync(projectCachePath)) {
      return [];
    }

    try {
      const items = readdirSync(projectCachePath);
      return items.filter(item => {
        const itemPath = join(projectCachePath, item);
        return statSync(itemPath).isDirectory();
      });
    } catch (e) {
      return [];
    }
  }

  private printStats(stats: CacheStats): void {
    console.log('');
    console.log('📊 Zenith Build Statistics');
    console.log('═══════════════════════════════════════');
    console.log('');
    
    console.log('📁 Projects Overview');
    console.log('───────────────────────────────────────');
    console.log(`   Total projects: ${Object.keys(this.projects).length}`);
    console.log(`   Cache path: ${this.cachePath}`);
    console.log(`   Total cache size: ${this.formatBytes(stats.totalSize)}`);
    console.log(`   Total cache files: ${stats.totalFiles}`);
    console.log('');

    if (this.verbose && stats.projects.length > 0) {
      console.log('📦 Project Details');
      console.log('───────────────────────────────────────');
      
      for (const project of stats.projects) {
        console.log(`   ${project.name}`);
        console.log(`      Path: ${project.path}`);
        console.log(`      Cache size: ${this.formatBytes(project.cacheSize)}`);
        console.log(`      Cache files: ${project.cacheFiles}`);
        if (project.targets.length > 0) {
          console.log(`      Cached targets: ${project.targets.join(', ')}`);
        } else {
          console.log(`      Cached targets: none`);
        }
        console.log('');
      }
    }

    // Summary
    const cachedProjects = stats.projects.filter(p => p.cacheFiles > 0).length;
    console.log('📈 Summary');
    console.log('───────────────────────────────────────');
    console.log(`   Projects with cache: ${cachedProjects}/${stats.projects.length}`);
    
    if (stats.totalSize > 0) {
      const avgCacheSize = stats.totalSize / stats.projects.length;
      console.log(`   Average cache per project: ${this.formatBytes(avgCacheSize)}`);
    }
    
    console.log('');
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// CLI wrapper for commander (used as default export)
export default class StatsRunnerCLI extends StatsRunner {
  constructor(...args: readonly string[]) {
    const program = new Command();
    program
      .option('-j, --json', 'Output statistics in JSON format', false)
      .option('-v, --verbose', 'Show detailed per-project statistics', false);
    program.parse(args);
    const opts = program.opts();
    super({
      json: opts.json as boolean,
      verbose: opts.verbose as boolean,
    });
  }
}
