import { readFileSync } from 'fs';
import * as path from 'path';;
import { ROOT_PATH } from '../utils/constants';

class ConfigHelper {
  constructor() {
    this.buildConfigJSON = JSON.parse(readFileSync(path.join(ROOT_PATH, 'build.config.json'), { encoding: 'utf-8' }));
    this.projects = JSON.parse(readFileSync(path.join(__dirname, 'Projects.json')));
  }

  getConfig(configName, root) {
    const exist = ['/apps/', '/bundlers/'].find(i => root.includes(i));
    return this.buildConfigJSON[configName] ? this.buildConfigJSON[configName] : this.buildConfigJSON[exist ? 'appConfig' : 'mainConfig'];
  }
}

const ConfigHelperInstance = new ConfigHelper();
export default ConfigHelperInstance;