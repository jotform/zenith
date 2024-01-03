import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import { ROOT_PATH } from '../utils/constants';
import {
  ProjectConfig, BuildConfig, TargetObject, ZenithConfigType, PipeConfigArray
} from '../types/ConfigTypes';

class ConfigHelper {
  buildConfigJSON: BuildConfig;

  projects: ProjectConfig;

  ignoreFiles: string[];

  appDirectories: string[];

  pipe: PipeConfigArray;

  onFail?: (failedTarget: string, details: unknown) => void;

  constructor() {
    const configPath = process.env.ZENITH_CONFIG_PATH || 'zenith.json';
    const config = this.parseConfig(path.join(ROOT_PATH, configPath));
    this.buildConfigJSON = config.buildConfig;
    this.pipe = config.pipe;
    this.projects = config.projects;
    this.ignoreFiles = this.getIgnoreFiles(config.ignore);
    this.appDirectories = config.appDirectories;
    this.onFail = config.onFail;
  }

  parseConfig(configPath: string): ZenithConfigType {
    if (!existsSync(configPath)) {
      throw new Error('Zenith config file not found');
    }
    // check if config is json or js
    const extension = path.extname(configPath);
    if (extension === '.js') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const config = (require(configPath)) as ZenithConfigType;
      return config;
    } 
    if (extension === '.json') {
      const config = readFileSync(configPath, { encoding: 'utf-8' });
      return JSON.parse(config) as ZenithConfigType;
    }
    throw new Error('Zenith config file must be a json or js file');
  }

  getConfig(configName: string, root: string): TargetObject {
    const exist = this.appDirectories.find(i => root.includes(i));
    return this.buildConfigJSON[configName] ? this.buildConfigJSON[configName] : this.buildConfigJSON[exist ? 'appConfig' : 'mainConfig'];
  }

  getCachePath(): string {
    if (typeof this.buildConfigJSON.cachePath === 'string') return this.buildConfigJSON.cachePath;
    return '.cache';
  }

  getIgnoreFiles(ignore: string[]): string[] {
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
