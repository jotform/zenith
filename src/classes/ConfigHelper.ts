import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import { ROOT_PATH } from '../utils/constants';
import {
  ProjectConfig, BuildConfig, TargetObject, ZenithConfigType
} from '../types/ConfigTypes';

class ConfigHelper {
  buildConfigJSON: BuildConfig;

  projects: ProjectConfig;

  ignoreFiles: Array<string>;

  appDirectories: Array<string>;

  constructor() {
    const config = JSON.parse(readFileSync(path.join(ROOT_PATH, 'zenith.json'), { encoding: 'utf-8' })) as ZenithConfigType;
    this.buildConfigJSON = config.buildConfig;
    this.projects = config.projects;
    this.ignoreFiles = this.getIgnoreFiles(config.ignore);
    this.appDirectories = config.appDirectories;
  }

  getConfig(configName: string, root: string): TargetObject {
    const exist = this.appDirectories.find(i => root.includes(i));
    return this.buildConfigJSON[configName] ? this.buildConfigJSON[configName] : this.buildConfigJSON[exist ? 'appConfig' : 'mainConfig'];
  }

  getCachePath(): string {
    if (typeof this.buildConfigJSON.cachePath === 'string') return this.buildConfigJSON.cachePath;
    return '.cache';
  }

  getIgnoreFiles(ignore: Array<string>): Array<string> {
    const ignoreFiles: string[] = [];
    const gitIgnorePath = path.join(ROOT_PATH, '.gitignore');
    if (existsSync(gitIgnorePath)) {
      const gitIgnore = readFileSync(gitIgnorePath, { encoding: 'utf-8' });
      gitIgnore.split('\n').forEach((line) => {
        if (line && !line.startsWith('#') && !ignoreFiles.includes(line)) ignoreFiles.push(line);
      });
    }
    ignore.forEach((dir) => {
      if (dir && !ignoreFiles.includes(dir)) ignoreFiles.push(dir);
    });

    return ignoreFiles;
  }
}

const ConfigHelperInstance = new ConfigHelper();
export default ConfigHelperInstance;
