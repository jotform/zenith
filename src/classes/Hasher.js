import { createHash } from 'crypto';
import { readdirSync, readFileSync, existsSync } from 'fs';
import * as path from 'path';

class Hasher {
  hashJSON = {};
  // buildJSONPath = path.join(__dirname, '../build.json');
  changedHash = [];
  newFiles = [];
  excludeDirs = ['node_modules', '.gitignore', 'build', 'lib', 'dist', 'cdn', 'playwright-report', 'webpack.sock', '.DS_Store'];

  constructor() {
    this.hashJSON = {};
  }

  updateDebugJSON(debugJSON) {
    this.debugJSON = debugJSON;
  }

  getDebugJSON() {
    return this.debugJSON;
  }

  getHash(directoryPath, script, debug, compareWith) {
    const hasher = createHash('sha256');
    if (script) Hasher.update(script);
    const directory = readdirSync(directoryPath, { withFileTypes: true });
    const packageJSONPath = path.join(directoryPath, 'package.json')
    if (existsSync(packageJSONPath)) {
      const packageJSON = JSON.parse(readFileSync(packageJSONPath, { encoding: 'utf-8' }));
      const dependencies = { ...(packageJSON.dependencies || {}), ...(packageJSON.devDependencies || {}) };
      Object.entries(dependencies).sort((a, b) => a[0] - b[0]).forEach(([key, value]) => {
        if (value === 'workspace:*' && this.hashJSON[key]) {
          Hasher.update(this.hashJSON[key]);
        }
      });
    }
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
        Hasher.update(fileString);
      } else if (item.isDirectory()) {
        Hasher.update(this.getHash(itemPath, script, debug, compareWith));
      }
    });
    return Hasher.digest('hex');
  }

  getUpdatedHashes() {
    return [this.changedHash, this.newFiles];
  }

  emptyUpdatedHashes() {
    this.changedHash = [];
    this.newFiles = [];
  }

  updateHashJSON() {
    // writeFileSync(this.buildJSONPath, JSON.stringify(this.hashJSON));
  }
}

const HasherInstance = new Hasher();
export default HasherInstance;