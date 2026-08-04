import { readFileSync } from 'fs';
import * as path from 'path';
import { Table } from 'voici.js';
import { ROOT_PATH } from '../../utils/constants';
import CacherFactory from '../Cache/CacheFactory';
import Hasher from '../Hasher';
import WorkerHelper from '../WorkerHelper';
import ConfigHelper from '../ConfigHelper';
import { deepCloneMap, isCommandDummy, isOutputTxt } from '../../utils/functions';
import { hrtimeToMs } from '../../utils/time';
import { buildTimeTable, buildSizeTable } from '../../stats/statsTables';
import { buildStatsSummary, statsRenderPlan } from '../../stats/statsSummary';
import StatsAggregator from '../../stats/StatsAggregator';
import Logger from '../../utils/logger';
import { BuildParams, PackageJsonType, ProjectRunStats } from '../../types/BuildTypes';
import LocalCacher from '../Cache/LocalCacher';
import RemoteCacher from '../Cache/RemoteCacher';
import { configManagerInstance } from '../../config';

export default class BuildHelper extends WorkerHelper {
  /** Set once on hard fail so concurrent builders don't race exit / mask the real error. */
  static exiting = false;

  projects : Map<string, Set<string>> = new Map();

  command : string;

  projectToBuild = '';

  totalCount = 0;

  stats = new StatsAggregator();

  get projectStats(): Map<string, ProjectRunStats> {
    return this.stats.projectStats;
  }

  /**
   * Fail the CLI without awaiting pool.terminate.
   * Workers blocked in execSync cannot be force-killed until the child exits, so
   * `await pool.terminate(true)` hangs for the duration of sibling builds.
   */
  failFast(buildProject: string, error: Error): never {
    if (!BuildHelper.exiting) {
      BuildHelper.exiting = true;
      Logger.log(3, this.outputColor, 'ERR-B1 :: project: ', buildProject, ' error: ', error.message);
      void this.pool.terminate(true).catch(() => undefined);
    }
    process.exit(1);
  }

  /** Cascade rejects from force-terminate — park until process.exit from the primary failure. */
  private static isTerminateCascade(error: Error): boolean {
    return error.message === 'Worker terminated' || error.message === 'Pool terminated';
  }

  compareHash = true;

  logAffected = false;

  skipDependencies = false;

  onlyDependencies = false;

  skipPackageJson = false;

  singleCache = false;

  debugLocation = 'debug/';

  startTime: [number, number] = [0, 0];

  debug = false;

  compareWith = '';

  noCache = false;

  cacher: RemoteCacher | LocalCacher;

  hasher = new Hasher();

  outputColor = '';

  constructor(command : string, worker : string, color: boolean) {
    super(command, worker);
    this.command = command;
    this.cacher = CacherFactory.getCacher();
    this.outputColor = color ? `\x1b[3${Math.floor(Math.random() * 6) + 1}m` : '';
  }

  async init({
    debug, compareWith, compareHash, logAffected, skipDependencies, onlyDependencies, debugLocation, skipPackageJson, singleCache, noCache, project, workspace
  }: BuildParams) : Promise<void> {
    this.compareHash = compareHash;
    this.logAffected = logAffected;
    this.skipDependencies = skipDependencies;
    this.onlyDependencies = onlyDependencies;
    this.debugLocation = debugLocation;
    this.skipPackageJson = skipPackageJson;
    this.singleCache = singleCache;
    this.noCache = noCache;
    this.startTime = process.hrtime();
    this.projectToBuild = project || 'all';
    const constantDependencies = ConfigHelper.getConfig('mainConfig', '')[this.command]?.constantDependencies || [];
    if (constantDependencies.length > 0) {
      constantDependencies.forEach(dependency => {
         this.addProject(dependency);
      });
    }
    if (workspace.size > 0) {
      this.projects = deepCloneMap(workspace);
    } else {
      if (this.projectToBuild === 'all') {
        this.buildAll();
      } else if (this.projectToBuild.includes(',')) {
        this.projectToBuild.split(',').forEach(project => {
          this.addProject(project.trim());
        });
      } else {
        this.addProject(this.projectToBuild);
      }
    }
    if (debug) {
      this.debug = debug;
      this.compareWith = compareWith;
      const debugJSON = await this.cacher.getDebugFile(compareWith, this.command, debugLocation) || {};
      this.hasher.updateDebugJSON(debugJSON);
    }
  }

  getProjects(): Map<string, Set<string>> {
    return this.projects;
  }

  recordProjectStats(buildProject: string, patch: Partial<ProjectRunStats>): void {
    this.stats.record(buildProject, patch);
  }

  addProject(project: string): void {
    if (!this.projects.has(project) && project && ConfigHelper.projects[project]) {
      try {
        const root = ConfigHelper.projects[project] || '';
        const packageJSON = JSON.parse(readFileSync(path.join(ROOT_PATH, root, 'package.json'), { encoding: 'utf-8' })) as PackageJsonType;
        const allDependencies: Record<string, string> = { ...packageJSON.dependencies, ...packageJSON.devDependencies };
        const dependencyArray = Object.keys(allDependencies);
        if (this.skipDependencies) {
          this.projects.set(project, new Set());
          return;
        }
        this.projects.set(project, new Set(dependencyArray.filter(i => ConfigHelper.projects[i])));
        dependencyArray.forEach(dependency => {
          this.addProject(dependency);
        });
      } catch (error) {
        if (error instanceof Error) {
          Logger.log(2, this.outputColor, 'Package.json file not found in the project!');
          throw error;
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * True if a directed path exists from `start` to `target` along workspace dependency edges.
   * `memo` caches results for the current `target`; `visiting` is the DFS stack (cycles → false, not memoized).
   */
  private projectReachableFrom(
    start: string,
    target: string,
    visiting: Set<string>,
    memo: Map<string, boolean>,
  ): boolean {
    if (start === target) return true;
    const memoized = memo.get(start);
    if (memoized !== undefined) return memoized;
    if (visiting.has(start)) return false;

    const outs = this.projects.get(start);
    if (!outs || outs.size === 0) {
      memo.set(start, false);
      return false;
    }

    visiting.add(start);
    let reachable = false;
    for (const next of outs) {
      if (this.projectReachableFrom(next, target, visiting, memo)) {
        reachable = true;
        break;
      }
    }
    visiting.delete(start);
    memo.set(start, reachable);
    return reachable;
  }

  controlCyclicDependencies() {
    this.projects.forEach((dependencies, project) => {
      const memo = new Map<string, boolean>();
      const visiting = new Set<string>();
      for (const dep of dependencies) {
        if (this.projectReachableFrom(dep, project, visiting, memo)) {
          throw new Error(`Cyclic dependency found between ${project} <=> ${dep}.`);
        }
      }
    });
  }

  buildAll(): void {
    const allProjects = ConfigHelper.projects;
    Object.keys(allProjects).forEach(project => {
      this.addProject(project);
    });

    this.controlCyclicDependencies();
  }

  removeProject(dependency: string): void {
    this.projects.delete(dependency);
    this.projects.forEach(project => {
      if (project.has(dependency)) {
        project.delete(dependency);
      }
    });
  }

  get dependencyFreeProjects(): Array<string> {
    const list: Array<string> = [];
    this.projects.forEach((value, key) => {
      if (!Array.from(value).length) {
        list.push(key);
      }
    });
    return list;
  }

  doesScriptExist(root: string, script: string): boolean {
    const packageJSON = JSON.parse(readFileSync(path.join(ROOT_PATH, root, 'package.json'), { encoding: 'utf-8' })) as PackageJsonType;
    return !!packageJSON.scripts?.[script];
  }

  async runTarget(buildPath: string, script: string, hash: string, root: string, outputs: Array<string>, buildProject: string, requiredFiles?: string[]): Promise<void> {
    const execution = await this.execute(buildPath, script, hash, root, outputs, buildProject, requiredFiles);
    if (execution instanceof Error) {
      throw execution;
    }
    const { output, execTime, metrics } = execution;
    if (!isCommandDummy(buildPath, script)) {
      Logger.log(2, this.outputColor, 'Cache does not exist for => ', buildProject, hash);
      this.recordProjectStats(buildProject, { status: 'MISS', execTime, metrics });
    } else {
      this.recordProjectStats(buildProject, { status: 'SKIP' });
    }
    if (output && isOutputTxt(outputs)) {
      Logger.log(2, this.outputColor, output);
    }
  }

  async buildResolver(project: string): Promise<void> {
    this.removeProject(project);
    await this.build();
  }

  async builder(buildProject: string) {
    try {
      this.totalCount++;
      const root = ConfigHelper.projects[buildProject];
      // TODO: Non cacheable projects control
      const config = ConfigHelper.getConfig(buildProject, root);
      // default behaviour: if target is not in build config, set output to stdout and script to target itself
      if (!config[this.command]) {
        config[this.command] = {
          outputs: ['stdout'],
          script: this.command
        };
      }
      const { outputs, script, constantDependencies, compareRemoteHashes, requiredFiles, additionalFiles } = config[this.command];
      const buildPath = path.join(ROOT_PATH, root);
      const hashStart = process.hrtime();
      const hash = await this.hasher.getHash(buildPath, script, this.debug, this.compareWith, constantDependencies, additionalFiles || []);
      this.recordProjectStats(buildProject, { hashMs: hrtimeToMs(process.hrtime(hashStart)) });
      this.hasher.hashJSON[buildProject] = hash;

      config[this.command].afterGetHashCallback?.(this, hash, buildProject);
      
      if (this.skipPackageJson && !this.doesScriptExist(root, script)) {
        Logger.log(3, this.outputColor, 'Skipping project => ', buildProject, ' because it does not have the script => ', script);
        this.recordProjectStats(buildProject, { status: 'SKIP' });
        await this.buildResolver(buildProject);
        return;
      }
      if (isCommandDummy(buildPath, script)) {
        Logger.log(3, this.outputColor, 'Skipping project => ', buildProject, ' because it is a dummy script (return value is true).');
        this.recordProjectStats(buildProject, { status: 'SKIP' });
        await this.buildResolver(buildProject);
        return;
      }
      if (this.noCache) {
        const execution = await this.execute(buildPath, script, '', root, outputs, buildProject, requiredFiles, this.noCache);
        if (execution instanceof Error) {
          throw execution;
        }
        this.recordProjectStats(buildProject, { status: 'BUILT', execTime: execution.execTime, metrics: execution.metrics });
        await this.buildResolver(buildProject);
        return;
      }
      if (this.compareWith) {
        const [changedFiles, newFiles] = this.hasher.getUpdatedHashes();
        if (changedFiles.length || newFiles.length) {
          Logger.log(3, this.outputColor, `Hash mismatched: \n Changed files => \n - ${changedFiles.join('\n')} \n New files => \n - ${newFiles.join('\n')}`);
          this.hasher.emptyUpdatedHashes();
        }
      }
      for (const output of outputs) {
        Logger.log(3, this.outputColor, 'Recovering from cache', buildProject, 'with hash => ', hash);
        const { result: recoverResponse, metrics } = await this.anotherJob(hash, root, output, script, this.compareHash && !!compareRemoteHashes, this.logAffected);
        if (recoverResponse === 'Cache not found') {
          await this.runTarget(buildPath, script, hash, root, outputs, buildProject, requiredFiles);
          break;
        }
        if (!recoverResponse) {
          const execution = await this.execute(buildPath, script, hash, root, outputs, buildProject, requiredFiles);
          if (execution instanceof Error) throw execution;
          this.recordProjectStats(buildProject, { status: 'STALE', execTime: execution.execTime, metrics: execution.metrics });
        } else {
          this.recordProjectStats(buildProject, { status: 'HIT', metrics });
        }
      }
      await this.buildResolver(buildProject);
    } catch (error) {
      if (error instanceof Error) {
        if (BuildHelper.isTerminateCascade(error) || BuildHelper.exiting) {
          // Sibling workers rejected by force-terminate — wait for primary failFast exit.
          await new Promise(() => undefined);
          return;
        }
        this.failFast(buildProject, error);
      } else throw new Error('Builder failed.');
    }
  }

  async build(): Promise<void> {
    let projects = this.dependencyFreeProjects;
    
    if (this.onlyDependencies) {
      // if onlyDependencies true, remove projectToBuild from projects.
      if (this.projectToBuild.includes(',')) {
        const projectsToFilter = this.projectToBuild.split(',').map(project => project.trim());
        projects = projects.filter(p => !projectsToFilter.includes(p));
      } else {
        projects = projects.filter(p => p !== this.projectToBuild);
      }
    }
    
    const stats = this.pool.stats();
    if (!projects.length) {
      if (!stats.pendingTasks && !stats.activeTasks) {
        void this.pool.terminate();
        Logger.log(2, this.outputColor, `Zenith completed command: ${this.command}. ${this.noCache ? '(Cache was not used)' : ''}`);
        if (this.projectStats.size > 0) {
          const statsMode = configManagerInstance.getConfigValue('ZENITH_STATS_MODE');
          const { showTables, builtOnly } = statsRenderPlan(statsMode);
          if (showTables) {
            const timeRows = buildTimeTable(this.projectStats, { builtOnly });
            if (timeRows.length > 0) {
              // eslint-disable-next-line no-console
              console.log(this.outputColor, 'Build — by time');
              (new Table(timeRows)).print();
              // eslint-disable-next-line no-console
              console.log('\x1b[0m');
            }
            const sizeRows = buildSizeTable(this.projectStats, { builtOnly });
            if (sizeRows.length > 0) {
              // eslint-disable-next-line no-console
              console.log(this.outputColor, 'Largest Artifacts');
              (new Table(sizeRows)).print();
              // eslint-disable-next-line no-console
              console.log('\x1b[0m');
            }
          }
          const summaryContext = { wallMs: hrtimeToMs(process.hrtime(this.startTime)) };
          // Stats block is independent of logLevel — print directly, not via Logger.
          // eslint-disable-next-line no-console
          buildStatsSummary(this.projectStats, summaryContext).forEach(line => console.log(`${this.outputColor}${line}`, '\x1b[0m'));
        }
        if (this.debug && configManagerInstance.getConfigValue('ZENITH_DEBUG_ID')) {
          this.cacher.updateDebugFile(this.hasher.getDebugJSON(), this.command, this.debugLocation);
          Logger.log(2, this.outputColor, 'DEBUG JSON UPDATED');
        }
      }
      return;
    }
    await Promise.all(projects.map(async eachProject => {
      if (!this.started.has(eachProject)) {
        this.started.add(eachProject);
        await this.builder(eachProject);
      }
    }));
  }
}
