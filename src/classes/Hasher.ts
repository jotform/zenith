import { Hash, createHash } from 'crypto';
import { createReadStream, existsSync, readFileSync } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import * as path from 'path';
import { ROOT_PATH } from '../utils/constants';
import ConfigHelperInstance from './ConfigHelper';
import { DebugJSON } from '../types/ConfigTypes';
import { isEmpty } from '../utils/functions';
import { PackageJsonType } from '../types/BuildTypes';

/** Files larger than this are hashed via read stream (lower peak memory, same digest). */
const FILE_STREAM_THRESHOLD_BYTES = 256 * 1024;

export class Hasher {
  changedHash: Array<string> = [];

  newFiles: Array<string> = [];

  excludeDirs: Set<string>;

  debugJSON: DebugJSON = {};

  hashJSON: DebugJSON;

  constructor() {
    this.hashJSON = {};
    this.excludeDirs = new Set(ConfigHelperInstance.ignoreFiles);
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

  private applyDebugFromDigest(itemPath: string, debugHash: string, compareWith?: string): void {
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

  /** Stream one file into the tree hasher (and optional per-file debug hasher). */
  private async streamFileIntoHashers(
    hasher: Hash,
    itemPath: string,
    debug: boolean | undefined,
    compareWith: string | undefined,
  ): Promise<void> {
    const debugHasher = debug ? createHash('sha256') : null;
    const stream = createReadStream(itemPath);
    try {
      for await (const chunk of stream) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        hasher.update(buf);
        if (debugHasher) debugHasher.update(buf);
      }
    } catch {
      return;
    }
    if (debug && debugHasher) {
      const debugHash = debugHasher.digest('hex');
      this.applyDebugFromDigest(itemPath, debugHash, compareWith);
    }
  }

  async getHash(
    directoryPath: string,
    script?: string,
    debug?: boolean,
    compareWith?: string,
    constantDeps?: Array<string>,
    additionalFiles: Array<string> = [],
    isFirst = true,
  ): Promise<string> {
    const hasher = createHash('sha256');
    if (isFirst && script) {
      hasher.update(script);
    }

    if (isFirst && additionalFiles.length > 0) {
      const additionalMeta = await Promise.all(
        additionalFiles.map(async (filePath) => {
          const fullPath = path.join(ROOT_PATH, filePath);
          if (!existsSync(fullPath)) return { skip: true as const };
          try {
            const st = await stat(fullPath);
            if (!st.isFile()) return { skip: true as const };
            if (st.size > FILE_STREAM_THRESHOLD_BYTES) return { stream: true as const, fullPath };
            const buf = await readFile(fullPath);
            return { buffer: buf, fullPath };
          } catch {
            return { skip: true as const };
          }
        }),
      );
      for (const m of additionalMeta) {
        if ('skip' in m && m.skip) continue;
        if ('buffer' in m && m.buffer) hasher.update(m.buffer);
        else if ('stream' in m && m.stream) await this.streamFileIntoHashers(hasher, m.fullPath, false, undefined);
      }
    }

    const directory = await readdir(directoryPath, { withFileTypes: true });
    if (directory.length === 0) return '';
    if (isFirst) {
      if (constantDeps) this.updateHashWithArray(hasher, constantDeps);
      else this.updateDependencyHash(hasher, directoryPath);
    }

    type Step = { kind: 'file'; itemPath: string } | { kind: 'dir'; itemPath: string };
    const steps: Step[] = [];
    for (const item of directory) {
      if (this.excludeDirs.has(item.name)) continue;
      const itemPath = path.join(directoryPath, item.name);
      if (item.isFile()) {
        steps.push({ kind: 'file', itemPath });
      } else if (item.isDirectory() && !isEmpty(itemPath)) {
        steps.push({ kind: 'dir', itemPath });
      }
    }

    const filePaths = steps.filter((s): s is { kind: 'file'; itemPath: string } => s.kind === 'file').map(s => s.itemPath);
    const fileStats = await Promise.all(filePaths.map(p => stat(p).catch(() => null)));
    const smallFileBuffers = await Promise.all(
      filePaths.map((p, i) => {
        const st = fileStats[i];
        if (!st?.isFile() || st.size > FILE_STREAM_THRESHOLD_BYTES) return Promise.resolve(null as Buffer | null);
        return readFile(p).catch(() => null);
      }),
    );

    let fileIndex = 0;
    for (const step of steps) {
      if (step.kind === 'file') {
        const i = fileIndex;
        fileIndex += 1;
        const st = fileStats[i];
        const buf = smallFileBuffers[i];
        if (!st?.isFile()) continue;

        if (buf) {
          if (debug) {
            const debugHash = createHash('sha256').update(buf).digest('hex');
            this.applyDebugFromDigest(step.itemPath, debugHash, compareWith);
          }
          hasher.update(buf);
        } else {
          await this.streamFileIntoHashers(hasher, step.itemPath, debug, compareWith);
        }
      } else {
        const dirHash = await this.getHash(step.itemPath, script, debug, compareWith, constantDeps, [], false);
        if (dirHash) hasher.update(dirHash);
      }
    }
    return hasher.digest('hex');
  }

  async getSingleHash({
    script, debug, compareWith, projects,
  }: {
    script: string,
    projects: Map<string, Set<string>>,
    debug?: boolean,
    compareWith?: string,
  }): Promise<string> {
    const hasher = createHash('sha256');
    const projectNames = Array.from(projects.keys());
    const projectHashes = await Promise.all(
      projectNames.map(async (projectName) => {
        const projectRoot = ConfigHelperInstance.projects[projectName];
        const buildPath = path.join(ROOT_PATH, projectRoot);
        return this.getHash(buildPath, script, debug, compareWith, undefined, []);
      }),
    );
    projectHashes.forEach((h) => {
      hasher.update(h);
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

export default Hasher;
