import { readFileSync } from 'fs';
import * as path from 'path';
import { Table } from 'voici.js';
import { ROOT_PATH } from '../../utils/constants';
import CacherFactory from '../Cache/CacheFactory';
import Hasher from '../Hasher';
import WorkerHelper from '../WorkerHelper';
import ConfigHelper from '../ConfigHelper';
import { deepCloneMap, formatMissingProjects, formatTimeDiff, isCommandDummy, isOutputTxt } from '../../utils/functions';
import Logger from '../../utils/logger';
import { ProjectStats, BuildParams, PackageJsonType, MissingProjectStats } from '../../types/BuildTypes';
import LocalCacher from '../Cache/LocalCacher';
import RemoteCacher from '../Cache/RemoteCacher';
import { configManagerInstance } from '../../config';

export default class BuildHelper extends WorkerHelper {
  projects : Map<string, Set<string>> = new Map();

  command : string;

  projectToBuild = '';

  totalCount = 0;

  fromCache = 0;

  built = 0;

  missingProjects : Array<MissingProjectStats> = [];

  hashMismatchProjects : Array<MissingProjectStats> = [];

  slowCacheRecoveries : Array<ProjectStats> = [];

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

  isCyclic(dependency: string, project: string, [...visited]: string[]): boolean {
    if (dependency === project) return true;
    if (visited.includes(dependency)) return false;

    const dependencySet = this.projects.get(dependency);
    if (!dependencySet) return false;

    visited.push(dependency);
    const dependencyArray = Array.from(dependencySet);
    return dependencyArray.some(n => this.isCyclic(n, project, visited));
  }

  controlCyclicDependencies() {
    this.projects.forEach((dependencies, project) => {
      const dependencyArray = Array.from(dependencies);
      dependencyArray.forEach(dep => {
        if (this.isCyclic(dep, project, [])) throw new Error(`Cyclic dependency found between ${project} <=> ${dep}.`);
      });
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
      throw Error;
    }
    const { output, execTime, cacheTime } = execution;
    if (!isCommandDummy(buildPath, script)) {
      Logger.log(2, this.outputColor, 'Cache does not exist for => ', buildProject, hash);
      this.missingProjects.push({ buildProject, execTime, cacheTime });
    }
    if (output && isOutputTxt(outputs)) {
      Logger.log(2, this.outputColor, output);
    }
    this.built++;
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
      const hash = this.hasher.getHash(buildPath, script, this.debug, this.compareWith, constantDependencies, additionalFiles || []);
      this.hasher.hashJSON[buildProject] = hash;

      if (this.skipPackageJson && !this.doesScriptExist(root, script)) {
        Logger.log(3, this.outputColor, 'Skipping project => ', buildProject, ' because it does not have the script => ', script);
        await this.buildResolver(buildProject);
        return;
      }
      if (isCommandDummy(buildPath, script)) {
        Logger.log(3, this.outputColor, 'Skipping project => ', buildProject, ' because it is a dummy script (return value is true).');
        await this.buildResolver(buildProject);
        return;
      }
      if (this.noCache) {
        await this.execute(buildPath, script, '', root, outputs, buildProject, requiredFiles, this.noCache);
        this.built++;
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
        const {result: recoverResponse, time} = await this.anotherJob(hash, root, output, script, this.compareHash && !!compareRemoteHashes, this.logAffected);
        if (recoverResponse === 'Cache not found') {
          await this.runTarget(buildPath, script, hash, root, outputs, buildProject, requiredFiles);
          break;
        }
        if (!recoverResponse) {
          const execution = await this.execute(buildPath, script, hash, root, outputs, buildProject, requiredFiles);
          if (execution instanceof Error) throw execution;
          this.hashMismatchProjects.push({ buildProject, execTime: execution.execTime, cacheTime: execution.cacheTime });
          this.built++;
        } else {
          this.fromCache++;
          const delta = Number((time[0] + time[1] / 1e9).toFixed(3));
          if (delta > 10) {
            this.slowCacheRecoveries.push({ buildProject, time });
          }
        }
      }
      await this.buildResolver(buildProject);
    } catch (error) {
      if (error instanceof Error) {
        Logger.log(3, this.outputColor, 'ERR-B1 :: project: ', buildProject, ' error: ', error.message);
        await this.pool.terminate(true);
        throw error;
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
        Logger.log(2, this.outputColor, `Total of ${this.totalCount} project${this.totalCount === 1 ? ' is' : 's are'} finished.`);
        Logger.log(2, this.outputColor, `${this.fromCache} projects used from cache,`);
        Logger.log(2, this.outputColor, `${this.built} projects used without cache.`);
        // eslint-disable-next-line no-console
        console.log(this.outputColor);
        if (this.missingProjects.length > 0 && Logger.logLevel > 1) {
          (new Table(formatMissingProjects(this.missingProjects, `Missing Projects (${this.missingProjects.length})`))).print();
          // eslint-disable-next-line no-console
          console.log('\n');
        }
        if (this.slowCacheRecoveries.length > 0 && Logger.logLevel > 1) {
          (new Table(formatMissingProjects(this.slowCacheRecoveries, `Slow Cache Recoveries (${this.slowCacheRecoveries.length})`))).print();
        }
        if (this.hashMismatchProjects.length > 0 && Logger.logLevel > 1) {
          (new Table(formatMissingProjects(this.hashMismatchProjects, `Hash Mismatches (${this.hashMismatchProjects.length})`))).print();
        }
        // eslint-disable-next-line no-console
        console.log("\x1b[0m");
        Logger.log(2, this.outputColor, `Total process took ${formatTimeDiff(process.hrtime(this.startTime))}.`);
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
