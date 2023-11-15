/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { readFileSync } from 'fs';
import * as path from 'path';
import { ROOT_PATH } from '../utils/constants';
import CacherFactory from './Cache/CacheFactory';
import Hasher from './Hasher';
import WorkerHelper from './WorkerHelper';
import ConfigHelper from './ConfigHelper';
import { formatMissingProjects, formatTimeDiff, isCommandDummy, isOutputTxt } from '../utils/functions';
import Logger from '../utils/logger';
import { ProjectStats, BuildParams, PackageJsonType } from '../types/BuildTypes';
import LocalCacher from './Cache/LocalCacher';
import RemoteCacher from './Cache/RemoteCacher';
import { configManagerInstance } from '../config';

export default class BuildHelper extends WorkerHelper {
  projects : Map<string, Set<string>> = new Map();

  command : string;

  totalCount = 0;

  fromCache = 0;

  built = 0;

  missingProjects : Array<ProjectStats> = [];

  hashMismatchProjects : Array<ProjectStats> = [];

  slowCacheRecoveries : Array<ProjectStats> = [];

  compareHash = true;

  logAffected = false;

  skipDependencies = false;

  skipPackageJson = false;

  debugLocation = 'debug/';

  startTime: [number, number] = [0, 0];

  debug = false;

  compareWith = '';

  noCache = false;

  cacher: RemoteCacher | LocalCacher;

  constructor(command : string, worker : string) {
    super(command, worker);
    this.command = command;
    this.cacher = CacherFactory.getCacher();
  }

  async init({
    debug, compareWith, compareHash, logAffected, skipDependencies, debugLocation, skipPackageJson, noCache
  }: BuildParams) : Promise<void> {
    this.compareHash = compareHash;
    this.logAffected = logAffected;
    this.skipDependencies = skipDependencies;
    this.debugLocation = debugLocation;
    this.skipPackageJson = skipPackageJson;
    this.noCache = noCache;
    this.startTime = process.hrtime();
    if (debug) {
      this.debug = debug;
      this.compareWith = compareWith;
      const debugJSON = await this.cacher.getDebugFile(compareWith, this.command, debugLocation) || {};
      Hasher.updateDebugJSON(debugJSON);
    }
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
          Logger.log(2, 'Package.json file not found in the project!');
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

  buildResolver(project: string): void {
    this.removeProject(project);
    this.build();
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
      const { outputs, script, constantDependencies, compareRemoteHashes, requiredFiles } = config[this.command];

      if (this.skipPackageJson && !this.doesScriptExist(root, script)) {
        Logger.log(3, 'Skipping project => ', buildProject, ' because it does not have the script => ', script);
        this.buildResolver(buildProject);
        return;
      }
      const buildPath = path.join(ROOT_PATH, root);
      if (isCommandDummy(buildPath, script)) {
        Logger.log(3, 'Skipping project => ', buildProject, ' because it is a dummy script (return value is true).');
        this.buildResolver(buildProject);
        return;
      }
      if (this.noCache) {
        await this.execute(buildPath, script, '', root, outputs, buildProject, requiredFiles, this.noCache);
        this.built++;
        this.buildResolver(buildProject);
        return;
      }
      const hash = Hasher.getHash(buildPath, script, this.debug, this.compareWith, constantDependencies);
      const isCached = await this.cacher.isCached(hash, root, outputs, script);
      if (this.compareWith) {
        const [changedFiles, newFiles] = Hasher.getUpdatedHashes();
        if (changedFiles.length || newFiles.length) {
          Logger.log(3, `Hash mismatched: \n Changed files => \n - ${changedFiles.join('\n')} \n New files => \n - ${newFiles.join('\n')}`);
          Hasher.emptyUpdatedHashes();
        }
      }
      if (!isCached) {
        const startTime = process.hrtime();
        const output = await this.execute(buildPath, script, hash, root, outputs, buildProject, requiredFiles);
        if (!isCommandDummy(buildPath, script)) {
          Logger.log(2, 'Cache does not exist for => ', buildProject, hash);
          this.missingProjects.push({ buildProject, time: process.hrtime(startTime) });
        }
        if (output instanceof Error) {
          // Error on executing shell command
          throw output;
        }
        if (output && isOutputTxt(outputs)) {
          Logger.log(2, output.output);
        }
        this.built++;
      } else if (outputs.length) {
        for (const output of outputs) {
          // const outputPath = path.join(ROOT_PATH, root, output);
          Logger.log(3, 'Recovering from cache', buildProject, 'with hash => ', hash);
          const startTime = process.hrtime();
          const recoverResponse = await this.anotherJob(hash, root, output, script, this.compareHash && !!compareRemoteHashes, this.logAffected);
          if (recoverResponse instanceof Error) {
            throw recoverResponse;
          }
          if (!recoverResponse) {
            await this.execute(buildPath, script, hash, root, outputs, buildProject, requiredFiles);
            this.hashMismatchProjects.push({ buildProject, time: process.hrtime(startTime) });
            this.built++;
          } else {
            this.fromCache++;
            const recoveryTime = process.hrtime(startTime);
            const delta = Number((recoveryTime[0] + recoveryTime[1] / 1e9).toFixed(3));
            if (delta > 10) {
              this.slowCacheRecoveries.push({ buildProject, time: recoveryTime });
            }
          }
        }
      }
      Hasher.hashJSON[buildProject] = hash;
      this.buildResolver(buildProject);
    } catch (error) {
      if (error instanceof Error) {
        Logger.log(3, 'ERR-B1 :: project: ', buildProject, ' error: ', error.message);
        await this.pool.terminate(true);
        throw error;
      } else throw new Error('Builder failed.');
    }
  }

  build(): void {
    const projects = this.dependencyFreeProjects;
    const stats = this.pool.stats();
    if (!projects.length) {
      if (!stats.pendingTasks && !stats.activeTasks) {
        void this.pool.terminate();
        Logger.log(2, `Zenith completed command: ${this.command}. ${this.noCache ? '(Cache was not used)' : ''}`);
        Logger.log(2, `Total of ${this.totalCount} project${this.totalCount === 1 ? ' is' : 's are'} finished.`);
        Logger.log(2, `${this.fromCache} projects used from cache,`);
        Logger.log(2, `${this.built} projects used without cache.`);
        if (this.missingProjects.length > 0) {
          Logger.log(2, `Cache is missing for following projects => ${formatMissingProjects(this.missingProjects)}`);
        }
        if (this.slowCacheRecoveries.length > 0) {
          Logger.log(2, `Cache recovered slowly for following projects => ${formatMissingProjects(this.slowCacheRecoveries)}`);
        }
        if (this.hashMismatchProjects.length > 0) {
          Logger.log(2, `Hashes mismatched for following projects => ${formatMissingProjects(this.hashMismatchProjects)}`);
        }
        Logger.log(2, `Total process took ${formatTimeDiff(process.hrtime(this.startTime))}.`);
        if (this.debug && configManagerInstance.getConfigValue('ZENITH_DEBUG_ID')) {
          this.cacher.updateDebugFile(Hasher.getDebugJSON(), this.command, this.debugLocation);
          Logger.log(2, 'DEBUG JSON UPDATED');
        }
      }
      return;
    }
    for (const eachProject of projects) {
      if (!this.started.has(eachProject)) {
        this.started.add(eachProject);
        void this.builder(eachProject);
      }
    }
  }
}
