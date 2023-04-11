import { readFileSync } from 'fs';
import * as path from 'path';
import { ROOT_PATH } from '../utils/constants';
import {
  ProjectConfig, BuildConfig, TargetObject
} from '../types/ConfigTypes';

class ConfigHelper {
  buildConfigJSON: BuildConfig;

  projects: ProjectConfig;

  ignoreFiles: Array<string>;

  appDirectories: Array<string>;

  constructor() {
    const config = JSON.parse(readFileSync(path.join(ROOT_PATH, 'zenith.json'), { encoding: 'utf-8' }));
    this.buildConfigJSON = config.buildConfig;
    this.projects = config.projects;
    this.ignoreFiles = config.ignore;
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
}

const ConfigHelperInstance = new ConfigHelper();
export default ConfigHelperInstance;
