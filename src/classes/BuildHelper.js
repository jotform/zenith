const { readFileSync } = require('fs');
import * as path from 'path';
import { ROOT_PATH } from '../utils/constants';
import Cacher from './Cacher';
import Hasher from './Hasher';
import WorkerHelper from './WorkerHelper';
import ConfigHelper from './ConfigHelper';

export default class BuildHelper extends WorkerHelper {
  projects = new Map();
  totalCount = 0;
  fromCache = 0;
  built = 0;
  missingProjects = [];

  constructor(command) {
    super(command);
  }

  async init(debug, compareWith) {
    this.cacher = new Cacher().cacher;
    if (debug) {
      this.debug = debug;
      this.compareWith = compareWith;
      const debugJSON = await this.cacher.getDebugFile(compareWith) || {};
      Hasher.updateDebugJSON(debugJSON);
    }
  }

  addProject(project) {
    if (!this.projects.has(project) && project && ConfigHelper.projects[project]) {
      const root = ConfigHelper.projects[project] || {};
      const packageJSON = JSON.parse(readFileSync(path.join(ROOT_PATH, root, 'package.json'), { encoding: 'utf-8' }));
      const dependencyArray = Object.keys({ ...packageJSON.dependencies, ...packageJSON.devDependencies });
      this.projects.set(project, new Set(dependencyArray.filter(i => ConfigHelper.projects[i])));
      dependencyArray.forEach(dependency => {
        this.addProject(dependency);
      });
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
    const { build: { outputs, script } } = ConfigHelper.getConfig(buildProject, root);
    const buildPath = path.join(ROOT_PATH, root);
    const hash = Hasher.getHash(buildPath, script, this.debug, this.compareWith);
    const isCached = await this.cacher.isCached(hash, root, outputs);
    if (this.compareWith) {
      const [changedFiles, newFiles] = Hasher.getUpdatedHashes();
      if (changedFiles.length || newFiles.length) {
        console.log(`Hash mismatched: \n Changed files => \n - ${changedFiles.join('\n')} \n New files => \n - ${newFiles.join('\n')}`);
        Hasher.emptyUpdatedHashes();
      }
    }
    if (!isCached) {
      console.log('Cache does not exist for => ', buildProject, hash);
      this.missingProjects.push(buildProject);
      const output = await this.execute(buildPath, script, hash, root, outputs);
      if (output instanceof Error) {
        // process.exit(0);
        throw new Error(output);
      }
      this.built++
    } else {
      if (outputs.length) {
        for (const output of outputs) {
          // const outputPath = path.join(ROOT_PATH, root, output);
          console.log('Recovering from cache', buildProject, 'with hash => ', hash);
          const recoverResponse = await this.anotherJob(hash, root, output);
          if (recoverResponse instanceof Error) {
            throw new Error(recoverResponse);
          }
          if (!recoverResponse) {
            // TODO: will remove in for loop sorry for shitty code anyone who sees it :((
            await this.execute(buildPath, script, hash, root, outputs);
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
        console.log(`
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
        console.log(`Total of ${this.totalCount} project has built.`);
        console.log(`${this.fromCache} project built from cache,`)
        console.log(`${this.built} project built without cache.`);
        console.log(`Cache is missing for following projects => \n${this.missingProjects.join('\n')}`);
        if (this.debug && process.env.ZENITH_DEBUG_ID) {
          this.cacher.updateDebugFile(Hasher.getDebugJSON());
          console.log('DEBUG JSON UPDATED');
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
