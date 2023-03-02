import * as fs from 'fs';
import * as path from 'path';;
import ROOT_PATH from './utils/Constants';
import readFileAsJSON from './utils/Functions';

export default class ConfigHelper {
  constructor() {
    this.buildConfigJSON = JSON.parse(fs.readFileSync(path.join(ROOT_PATH, 'build.config.json'), { encoding: 'utf-8' }));
    this.projects = JSON.parse(fs.readFileSync(path.join(__dirname, 'Projects.json')));
  }

  getConfig(configName, root) {
    const exist = ['/apps/', '/bundlers/'].find(i => root.includes(i));
    return this.buildConfigJSON[configName] ? this.buildConfigJSON[configName] : this.buildConfigJSON[exist ? 'appConfig' : 'mainConfig'];
  }
}
