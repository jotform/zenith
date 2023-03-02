const { readFileSync } = require('fs');
const path = require('path');
const { ROOT_PATH } = require('./src/utils/constants');
const { readFileAsJSON } = require('./src/utils/functions');

class ConfigHelper {
  constructor() {
    this.buildConfigJSON = JSON.parse(readFileSync(path.join(ROOT_PATH, 'build.config.json'), { encoding: 'utf-8' }));
    this.projects = JSON.parse(readFileSync(path.join(__dirname, 'projects.json')));
  }

  getConfig(configName, root) {
    const exist = ['/apps/', '/bundlers/'].find(i => root.includes(i));
    return this.buildConfigJSON[configName] ? this.buildConfigJSON[configName] : this.buildConfigJSON[exist ? 'appConfig' : 'mainConfig'];
  }
}

module.exports = new ConfigHelper();