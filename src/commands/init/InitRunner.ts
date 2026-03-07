import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { Command } from 'commander';

interface ZenithJsonConfig {
  projects: Record<string, string>;
  buildConfig: {
    cachePath: string;
    appConfig: Record<string, {
      script: string;
      outputs: string[];
    }>;
  };
}

export interface InitRunnerOptions {
  force?: boolean;
  output?: string;
}

export class InitRunner {
  protected force = false;
  protected outputFile = 'zenith.json';

  constructor(options: InitRunnerOptions = {}) {
    this.force = options.force ?? false;
    this.outputFile = options.output ?? 'zenith.json';
  }

  async run(): Promise<void> {
    const rootPath = process.cwd();
    const configPath = join(rootPath, this.outputFile);

    // Check if zenith.json already exists
    if (existsSync(configPath) && !this.force) {
      const message = `${this.outputFile} already exists. Use --force to overwrite.`;
      console.log(`❌ ${message}`);
      throw new Error(message);
    }

    console.log('🚀 Initializing Zenith configuration...\n');

    // Try to detect projects
    const projects = this.detectProjects(rootPath);
    
    if (Object.keys(projects).length === 0) {
      console.log('⚠️  No projects detected. Creating minimal configuration.');
    } else {
      console.log(`✅ Detected ${Object.keys(projects).length} project(s):`);
      Object.entries(projects).forEach(([name, path]) => {
        console.log(`   - ${name}: ${path}`);
      });
    }

    // Create default config
    const config: ZenithJsonConfig = {
      projects,
      buildConfig: {
        cachePath: '.zenith-cache',
        appConfig: {
          build: {
            script: 'build',
            outputs: ['build', 'dist']
          },
          test: {
            script: 'test',
            outputs: ['stdout']
          },
          lint: {
            script: 'lint',
            outputs: ['stdout']
          }
        }
      }
    };

    // Write config file
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\n✅ Created ${this.outputFile}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Review and customize zenith.json');
    console.log('   2. Run: pnpm zenith --target=build --project=all');
  }

  protected detectProjects(rootPath: string): Record<string, string> {
    const projects: Record<string, string> = {};
    const packageJsonPath = join(rootPath, 'package.json');

    // Try to read workspaces from package.json
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // Check for pnpm workspaces
        const pnpmWorkspacePath = join(rootPath, 'pnpm-workspace.yaml');
        if (existsSync(pnpmWorkspacePath)) {
          const workspaceContent = readFileSync(pnpmWorkspacePath, 'utf-8');
          const workspacePatterns = this.parsePnpmWorkspace(workspaceContent);
          this.resolveWorkspacePatterns(rootPath, workspacePatterns, projects);
        }
        // Check for yarn/npm workspaces in package.json
        else if (packageJson.workspaces) {
          const workspaces = Array.isArray(packageJson.workspaces) 
            ? packageJson.workspaces 
            : packageJson.workspaces.packages || [];
          this.resolveWorkspacePatterns(rootPath, workspaces, projects);
        }
      } catch (e) {
        console.warn('⚠️  Could not parse package.json');
      }
    }

    // If no workspaces found, look for common monorepo structures
    if (Object.keys(projects).length === 0) {
      const commonDirs = ['packages', 'apps', 'libs', 'projects'];
      for (const dir of commonDirs) {
        const dirPath = join(rootPath, dir);
        if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
          this.scanDirectory(rootPath, dirPath, projects);
        }
      }
    }

    return projects;
  }

  protected parsePnpmWorkspace(content: string): string[] {
    const patterns: string[] = [];
    const lines = content.split('\n');
    let inPackages = false;

    for (const line of lines) {
      if (line.trim() === 'packages:') {
        inPackages = true;
        continue;
      }
      if (inPackages && line.trim().startsWith('-')) {
        const pattern = line.trim().replace(/^-\s*['"]?/, '').replace(/['"]?\s*$/, '');
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  protected resolveWorkspacePatterns(
    rootPath: string, 
    patterns: string[], 
    projects: Record<string, string>
  ): void {
    for (const pattern of patterns) {
      // Handle glob patterns like "packages/*"
      const basePath = pattern.replace(/\/\*.*$/, '');
      const fullBasePath = join(rootPath, basePath);
      
      if (existsSync(fullBasePath) && statSync(fullBasePath).isDirectory()) {
        this.scanDirectory(rootPath, fullBasePath, projects);
      }
    }
  }

  protected scanDirectory(
    rootPath: string, 
    dirPath: string, 
    projects: Record<string, string>
  ): void {
    try {
      const items = readdirSync(dirPath);
      for (const item of items) {
        const itemPath = join(dirPath, item);
        if (statSync(itemPath).isDirectory()) {
          const packageJsonPath = join(itemPath, 'package.json');
          if (existsSync(packageJsonPath)) {
            try {
              const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const projectName = pkg.name || item;
              const relativePath = relative(rootPath, itemPath);
              projects[projectName] = relativePath;
            } catch (e) {
              // Skip invalid package.json
            }
          }
        }
      }
    } catch (e) {
      // Skip inaccessible directories
    }
  }
}

// CLI wrapper for commander (used as default export)
export default class InitRunnerCLI extends InitRunner {
  constructor(...args: readonly string[]) {
    const program = new Command();
    program
      .option('-f, --force', 'Overwrite existing zenith.json', false)
      .option('-o, --output <file>', 'Output file name', 'zenith.json');
    program.parse(args);
    const opts = program.opts();
    super({ force: opts.force as boolean, output: opts.output as string });
  }
}

