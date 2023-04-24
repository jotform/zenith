import { Hash, createHash } from 'crypto';
import { readdirSync, readFileSync, existsSync } from 'fs';
import * as path from 'path';
import ConfigHelperInstance from './ConfigHelper';
import { DebugJSON } from '../types/ConfigTypes';
import { isEmpty } from '../utils/functions';
import { PackageJsonType } from '../types/BuildTypes';

export class Hasher {
  // buildJSONPath = path.join(__dirname, '../build.json');

  changedHash: Array<string> = [];

  newFiles: Array<string> = [];

  excludeDirs: Array<string>;

  debugJSON: DebugJSON = {};

  hashJSON: DebugJSON;

  constructor() {
    this.hashJSON = {};
    this.excludeDirs = ConfigHelperInstance.ignoreFiles;
  }

  updateDebugJSON(debugJSON: DebugJSON): void {
    this.debugJSON = { ...debugJSON };
  }

  getDebugJSON(): DebugJSON {
    return this.debugJSON;
  }

  updateHashWithArray(hasher: Hash, array: Array<string>): void {
    array.forEach((element: string) => {
      if (this.hashJSON[element]) hasher.update(this.hashJSON[element]);
    });
  }

  updateDependencyHash(hasher: Hash, directoryPath: string): void {
    const packageJSONPath = path.join(directoryPath, 'package.json');
    if (existsSync(packageJSONPath)) {
      const packageJSON = JSON.parse(readFileSync(packageJSONPath, { encoding: 'utf-8' })) as PackageJsonType;
      const dependencies = { ...(packageJSON.dependencies || {}), ...(packageJSON.devDependencies || {}) };
      const sanitizedDependencies = Object.entries(dependencies)
        .sort((a, b) => (a > b ? -1 : 1))
        .filter(dep => dep[1] === 'workspace:*')
        .map(dep => dep[0]);
      this.updateHashWithArray(hasher, sanitizedDependencies);
    }
  }

  getHash(directoryPath: string, script?: string, debug?: boolean, compareWith?: string, constantDeps?: Array<string>, isFirst = true): string {
    const hasher = createHash('sha256');
    if (isFirst && script) hasher.update(script);
    const directory = readdirSync(directoryPath, { withFileTypes: true });
    if (directory.length === 0) return '';
    if (isFirst) {
      if (constantDeps) this.updateHashWithArray(hasher, constantDeps);
      else this.updateDependencyHash(hasher, directoryPath);
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
        hasher.update(fileString);
      } else if (item.isDirectory() && !isEmpty(itemPath)) {
        const dirHash = this.getHash(itemPath, script, debug, compareWith, constantDeps, false);
        if (dirHash) hasher.update(dirHash);
      }
    });
    return hasher.digest('hex');
  }

  getUpdatedHashes(): [Array<string>, Array<string>] {
    return [this.changedHash, this.newFiles];
  }

  emptyUpdatedHashes(): void {
    this.changedHash = [];
    this.newFiles = [];
  }

  // TODO :: Not used.
  updateHashJSON(): void {
    // writeFileSync(this.buildJSONPath, JSON.stringify(this.hashJSON));
  }
}

const HasherInstance = new Hasher();
export default HasherInstance;
