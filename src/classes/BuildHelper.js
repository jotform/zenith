import { readFileSync } from 'fs';
import * as path from 'path';
import { ROOT_PATH } from '../utils/constants';
import Cacher from './Cacher';
import Hasher from './Hasher';
import WorkerHelper from './WorkerHelper';
import ConfigHelper from './ConfigHelper';
import { formatMissingProjects, formatTimeDiff, isOutputTxt } from '../utils/functions';
import Logger from '../utils/logger'

export default class BuildHelper extends WorkerHelper {
  projects = new Map();
  totalCount = 0;
  fromCache = 0;
  built = 0;
  missingProjects = [];
  hashMismatchProjects = [];

  constructor(command, worker) {
    super(command, worker);
    this.command = command;
  }

  async init({debug, compareWith, compareHash, logAffected}) {
    this.cacher = new Cacher().cacher;
    this.compareHash = compareHash;
    this.logAffected = logAffected;
    this.startTime = process.hrtime();
    if (debug) {
      this.debug = debug;
      this.compareWith = compareWith;
      const debugJSON = await this.cacher.getDebugFile(compareWith, this.command) || {};
      Hasher.updateDebugJSON(debugJSON);
    }
  }

  addProject(project) {
    if (!this.projects.has(project) && project && ConfigHelper.projects[project]) {
      try {
        const root = ConfigHelper.projects[project] || {};
        const packageJSON = JSON.parse(readFileSync(path.join(ROOT_PATH, root, 'package.json'), { encoding: 'utf-8' }));
        const dependencyArray = Object.keys({ ...packageJSON.dependencies, ...packageJSON.devDependencies });
        this.projects.set(project, new Set(dependencyArray.filter(i => ConfigHelper.projects[i])));
        dependencyArray.forEach(dependency => {
          this.addProject(dependency);
        });
      } catch (error) {
        if (error.code === 'ENOENT') {
          Logger.log(2, 'Package.json file not found in the project!');
          throw error;
        } else {
          throw error;
        }
      }
    }
  }

  buildAll() {
    const allProjects = ConfigHelper.projects;
    Object.keys(allProjects).forEach(project => {
      this.addProject(project);
    })
  }

  removeProject(dependency) {
    this.projects.delete(dependency);
    this.projects.forEach(project => {
      if (project.has(dependency)) {
        project.delete(dependency);
      }
    });
  }

  get dependencyFreeProjects() {
    const list = [];
    this.projects.forEach((value, key) => {
      if (!Array.from(value).length) {
        list.push(key);
      }
    });
    return list;
  }

  buildResolver(project) {
    this.removeProject(project);
    this.build();
  }

  async builder(buildProject) {
    this.totalCount++
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
    const {outputs, script, constantDependencies} = config[this.command];
    const buildPath = path.join(ROOT_PATH, root);
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
      Logger.log(3, 'Cache does not exist for => ', buildProject, hash);
      const startTime = process.hrtime();
      const output = await this.execute(buildPath, script, hash, root, outputs, buildProject);
      this.missingProjects.push({ buildProject, time: process.hrtime(startTime)});
      if (output instanceof Error) {
        // process.exit(0);
        Logger.log(2, 'Error in path ::', buildPath);
        Logger.log(2, output);
        throw new Error(output);
      }
      if (isOutputTxt(outputs)) {
        Logger.log(2, output.output)
      }
      this.built++
    } else {
      if (outputs.length) {
        for (const output of outputs) {
          // const outputPath = path.join(ROOT_PATH, root, output);
          Logger.log(3, 'Recovering from cache', buildProject, 'with hash => ', hash);
          const startTime = process.hrtime();
          const recoverResponse = await this.anotherJob(hash, root, output, script, this.compareHash, this.logAffected);
          if (recoverResponse instanceof Error) {
            throw new Error(recoverResponse);
          }
          if (!recoverResponse) {
            // TODO: will remove in for loop sorry for shitty code anyone who sees it :((
            await this.execute(buildPath, script, hash, root, outputs, buildProject);
            this.hashMismatchProjects.push({ buildProject, time: process.hrtime(startTime)});
            this.built++
          } else {
            this.fromCache++
          }
        }
      }
    }
    Hasher.hashJSON[buildProject] = hash;
    this.buildResolver(buildProject);
  }

  build() {
    const projects = this.dependencyFreeProjects;
    const stats = this.pool.stats();
    if (!projects.length) {
      if (!stats.pendingTasks && !stats.activeTasks) {
        this.pool.terminate();
        Logger.log(2, `
 ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄       ▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄            ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄   ▄ 
▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░▌     ▐░░▌▐░░░░░░░░░░░▌▐░▌          ▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░▌ ▐░▌
▐░█▀▀▀▀▀▀▀▀▀ ▐░█▀▀▀▀▀▀▀█░▌▐░▌░▌   ▐░▐░▌▐░█▀▀▀▀▀▀▀█░▌▐░▌          ▐░█▀▀▀▀▀▀▀▀▀  ▀▀▀▀█░█▀▀▀▀ ▐░█▀▀▀▀▀▀▀▀▀ ▐░█▀▀▀▀▀▀▀█░▌▐░▌
▐░▌          ▐░▌       ▐░▌▐░▌▐░▌ ▐░▌▐░▌▐░▌       ▐░▌▐░▌          ▐░▌               ▐░▌     ▐░▌          ▐░▌       ▐░▌▐░▌
▐░▌          ▐░▌       ▐░▌▐░▌ ▐░▐░▌ ▐░▌▐░█▄▄▄▄▄▄▄█░▌▐░▌          ▐░█▄▄▄▄▄▄▄▄▄      ▐░▌     ▐░█▄▄▄▄▄▄▄▄▄ ▐░▌       ▐░▌▐░▌
▐░▌          ▐░▌       ▐░▌▐░▌  ▐░▌  ▐░▌▐░░░░░░░░░░░▌▐░▌          ▐░░░░░░░░░░░▌     ▐░▌     ▐░░░░░░░░░░░▌▐░▌       ▐░▌▐░▌
▐░▌          ▐░▌       ▐░▌▐░▌   ▀   ▐░▌▐░█▀▀▀▀▀▀▀▀▀ ▐░▌          ▐░█▀▀▀▀▀▀▀▀▀      ▐░▌     ▐░█▀▀▀▀▀▀▀▀▀ ▐░▌       ▐░▌▐░▌
▐░▌          ▐░▌       ▐░▌▐░▌       ▐░▌▐░▌          ▐░▌          ▐░▌               ▐░▌     ▐░▌          ▐░▌       ▐░▌ ▀ 
▐░█▄▄▄▄▄▄▄▄▄ ▐░█▄▄▄▄▄▄▄█░▌▐░▌       ▐░▌▐░▌          ▐░█▄▄▄▄▄▄▄▄▄ ▐░█▄▄▄▄▄▄▄▄▄      ▐░▌     ▐░█▄▄▄▄▄▄▄▄▄ ▐░█▄▄▄▄▄▄▄█░▌ ▄ 
▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░▌       ▐░▌▐░▌          ▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌     ▐░▌     ▐░░░░░░░░░░░▌▐░░░░░░░░░░▌ ▐░▌
 ▀▀▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀▀▀  ▀         ▀  ▀            ▀▀▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀▀▀       ▀       ▀▀▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀▀   ▀                                                                                                                                                                                                  
`);
        Logger.log(2, `Total of ${this.totalCount} project${this.totalCount === 1 ? ' is' : 's are'} finished.`);
        Logger.log(2, `${this.fromCache} projects used from cache,`);
        Logger.log(2, `${this.built} projects used without cache.`);
        Logger.log(2, `Cache is missing for following projects => ${formatMissingProjects(this.missingProjects)}`);
        Logger.log(2, `Hashes mismatched for following projects => ${formatMissingProjects(this.hashMismatchProjects)}`);
        Logger.log(2, `Total process took ${formatTimeDiff(process.hrtime(this.startTime))}.`);
        if (this.debug && process.env.ZENITH_DEBUG_ID) {
          this.cacher.updateDebugFile(Hasher.getDebugJSON(), this.command);
          Logger.log(2, 'DEBUG JSON UPDATED');
        }
      }
      return;
    }
    for (const eachProject of projects) {
      if (!this.started.has(eachProject)) {
        this.started.add(eachProject);
        this.builder(eachProject);
      }
    }
  }
}
