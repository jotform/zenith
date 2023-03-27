import { readFileSync } from 'fs';
import * as path from 'path';
import { ROOT_PATH } from '../utils/constants';

class ConfigHelper {
  constructor() {
    const config = JSON.parse(readFileSync(path.join(ROOT_PATH, 'zenith.json'), { encoding: 'utf-8' }));
    this.buildConfigJSON = config.buildConfig;
    this.projects = config.projects;
    this.ignoreFiles = config.ignore;
  }

  getConfig(configName, root) {
    const exist = ['/apps/', '/bundlers/'].find(i => root.includes(i));
    return this.buildConfigJSON[configName] ? this.buildConfigJSON[configName] : this.buildConfigJSON[exist ? 'appConfig' : 'mainConfig'];
  }
}

const ConfigHelperInstance = new ConfigHelper();
export default ConfigHelperInstance;
