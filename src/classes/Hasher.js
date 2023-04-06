import { createHash } from 'crypto';
import { readdirSync, readFileSync, existsSync } from 'fs';
import * as path from 'path';
import { ROOT_PATH } from '../utils/constants';
import ConfigHelperInstance from './ConfigHelper';

export class Hasher {
  hashJSON = {};
  // buildJSONPath = path.join(__dirname, '../build.json');
  changedHash = [];
  newFiles = [];

  constructor() {
    this.hashJSON = {};
    this.excludeDirs = ConfigHelperInstance.ignoreFiles;
  }

  updateDebugJSON(debugJSON) {
    this.debugJSON = { ...debugJSON };
  }

  getDebugJSON() {
    return this.debugJSON;
  }

  updateHashWithArray(hasher, array) {
    array.forEach(element => {
      if (this.hashJSON[element]) hasher.update(this.hashJSON[element]);
    })
  }

  updateDependencyHash(hasher, directoryPath) {
    const packageJSONPath = path.join(directoryPath, 'package.json')
    if (existsSync(packageJSONPath)) {
      const packageJSON = JSON.parse(readFileSync(packageJSONPath, { encoding: 'utf-8' }));
      const dependencies = { ...(packageJSON.dependencies || {}), ...(packageJSON.devDependencies || {}) };
      const sanitizedDependencies = Object.entries(dependencies)
        .sort((a,b) => a[0] - b[0])
        .filter(dep => dep[1] === 'workspace:*')
        .map(dep => dep[0])
      this.updateHashWithArray(hasher, sanitizedDependencies)
    }
  }

  getHash(directoryPath, script, debug, compareWith, constantDeps) {
    const hasher = createHash('sha256');
    if (script) hasher.update(script);
    const directory = readdirSync(directoryPath, { withFileTypes: true });
    if (constantDeps) this.updateHashWithArray(hasher, constantDeps);
    else this.updateDependencyHash(hasher, directoryPath);
    directory.forEach(item => {
      if (this.excludeDirs.indexOf(item.name) !== -1) return;
      const itemPath = path.join(directoryPath, item.name);
      if (item.isFile()) {
        const fileString = readFileSync(itemPath, { encoding: 'utf-8' });
        if (debug) {
          const debugHasher = createHash('sha256');
          debugHasher.update(fileString);
          const debugHash = debugHasher.digest('hex');
          if (compareWith) {
            if (this.debugJSON[itemPath]) {
              if (this.debugJSON[itemPath] !== debugHash) {
                this.changedHash.push(itemPath);
              }
            } else {
              this.newFiles.push(itemPath);
            }
          }
          this.debugJSON[itemPath] = debugHash;
        }
        hasher.update(fileString);
      } else if (item.isDirectory()) {
        hasher.update(this.getHash(itemPath, script, debug, compareWith, constantDeps));
      }
    });
    return hasher.digest('hex');
  }

  getUpdatedHashes() {
    return [this.changedHash, this.newFiles];
  }

  emptyUpdatedHashes() {
    this.changedHash = [];
    this.newFiles = [];
  }

  // TODO :: Not used.
  updateHashJSON() {
    // writeFileSync(this.buildJSONPath, JSON.stringify(this.hashJSON));
  }
}

const HasherInstance = new Hasher();
export default HasherInstance;