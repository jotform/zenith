import { Hash, createHash } from 'crypto';
import { createReadStream, existsSync, readFileSync } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import * as path from 'path';
import { ROOT_PATH } from '../utils/constants';
import ConfigHelperInstance from './ConfigHelper';
import { DebugJSON } from '../types/ConfigTypes';
import { isEmpty } from '../utils/functions';
import { PackageJsonType } from '../types/BuildTypes';
import MerkleIndex from './Merkle/MerkleIndex';
import {
  formatMerkleDigest,
  HasherPerfCounters,
  MerkleNode,
} from './Merkle/types';

/** Files larger than this are hashed via read stream (lower peak memory, same digest). */
const FILE_STREAM_THRESHOLD_BYTES = 256 * 1024;

export class Hasher {
  changedHash: Array<string> = [];

  newFiles: Array<string> = [];

  excludeDirs: Set<string>;

  debugJSON: DebugJSON = {};

  hashJSON: DebugJSON;

  merkleIndex = new MerkleIndex();

  perf: HasherPerfCounters = { filesHashed: 0, filesReused: 0, bytesRead: 0 };

  constructor() {
    this.hashJSON = {};
    this.excludeDirs = new Set(ConfigHelperInstance.ignoreFiles);
  }

  resetPerfCounters(): void {
    this.perf = { filesHashed: 0, filesReused: 0, bytesRead: 0 };
  }

  getPerfCounters(): HasherPerfCounters {
    return { ...this.perf };
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

  private async hashFileContents(itemPath: string, size: number): Promise<string> {
    const hasher = createHash('sha256');
    if (size > FILE_STREAM_THRESHOLD_BYTES) {
      const stream = createReadStream(itemPath);
      for await (const chunk of stream) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        hasher.update(buf);
        this.perf.bytesRead += buf.length;
      }
    } else {
      const buf = await readFile(itemPath);
      hasher.update(buf);
      this.perf.bytesRead += buf.length;
    }
    this.perf.filesHashed += 1;
    return hasher.digest('hex');
  }

  private async hashFileLeaf(
    itemPath: string,
    debug?: boolean,
    compareWith?: string,
  ): Promise<string | null> {
    let st;
    try {
      st = await stat(itemPath);
    } catch {
      return null;
    }
    if (!st.isFile()) return null;

    const relPath = MerkleIndex.toRelPath(itemPath);
    const cached = this.merkleIndex.get(relPath);
    if (
      cached
      && cached.kind === 'file'
      && cached.mtimeMs === st.mtimeMs
      && cached.size === st.size
    ) {
      this.perf.filesReused += 1;
      if (debug) this.applyDebugFromDigest(itemPath, cached.hash, compareWith);
      return cached.hash;
    }

    const contentHash = await this.hashFileContents(itemPath, st.size);
    const node: MerkleNode = {
      hash: contentHash,
      mtimeMs: st.mtimeMs,
      size: st.size,
      kind: 'file',
    };
    this.merkleIndex.set(relPath, node);
    if (debug) this.applyDebugFromDigest(itemPath, contentHash, compareWith);
    return contentHash;
  }

  private composeDirHash(
    children: Array<{ name: string; kind: 'file' | 'dir'; hash: string }>,
  ): string {
    const hasher = createHash('sha256');
    const sorted = [...children].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const child of sorted) {
      hasher.update(child.name);
      hasher.update('\0');
      hasher.update(child.kind);
      hasher.update('\0');
      hasher.update(child.hash);
      hasher.update('\n');
    }
    return hasher.digest('hex');
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
    const directory = await readdir(directoryPath, { withFileTypes: true });
    type Step = { kind: 'file'; name: string; itemPath: string } | { kind: 'dir'; name: string; itemPath: string };
    const steps: Step[] = [];
    for (const item of directory) {
      if (this.excludeDirs.has(item.name)) continue;
      const itemPath = path.join(directoryPath, item.name);
      if (item.isFile()) {
        steps.push({ kind: 'file', name: item.name, itemPath });
      } else if (item.isDirectory() && !isEmpty(itemPath)) {
        steps.push({ kind: 'dir', name: item.name, itemPath });
      }
    }
    steps.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    const children: Array<{ name: string; kind: 'file' | 'dir'; hash: string }> = [];
    for (const step of steps) {
      if (step.kind === 'file') {
        const leaf = await this.hashFileLeaf(step.itemPath, debug, compareWith);
        if (leaf) children.push({ name: step.name, kind: 'file', hash: leaf });
      } else {
        const dirHash = await this.getHash(step.itemPath, script, debug, compareWith, constantDeps, [], false);
        if (dirHash) {
          const hex = dirHash.startsWith('m1:') ? dirHash.slice(3) : dirHash;
          children.push({ name: step.name, kind: 'dir', hash: hex });
        }
      }
    }

    const dirHex = children.length === 0 && !isFirst ? '' : this.composeDirHash(children);
    const relPath = MerkleIndex.toRelPath(directoryPath);
    if (dirHex) {
      let mtimeMs = 0;
      let size = 0;
      try {
        const st = await stat(directoryPath);
        mtimeMs = st.mtimeMs;
        size = st.size;
      } catch {
        // ignore
      }
      this.merkleIndex.set(relPath, {
        hash: dirHex,
        mtimeMs,
        size,
        kind: 'dir',
      });
    }

    if (!isFirst) {
      return dirHex;
    }

    const rootHasher = createHash('sha256');
    if (script) rootHasher.update(script);

    if (additionalFiles.length > 0) {
      const additionalHashes: string[] = [];
      for (const filePath of additionalFiles) {
        const fullPath = path.join(ROOT_PATH, filePath);
        if (!existsSync(fullPath)) continue;
        try {
          const st = await stat(fullPath);
          if (!st.isFile()) continue;
          const leaf = await this.hashFileLeaf(fullPath, false, undefined);
          if (leaf) additionalHashes.push(leaf);
        } catch {
          // skip missing/unreadable
        }
      }
      additionalHashes.sort();
      for (const h of additionalHashes) rootHasher.update(h);
    }

    if (constantDeps) this.updateHashWithArray(rootHasher, constantDeps);
    else this.updateDependencyHash(rootHasher, directoryPath);

    if (dirHex) rootHasher.update(dirHex);

    return formatMerkleDigest(rootHasher.digest('hex'));
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
    const projectNames = Array.from(projects.keys()).sort();
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
    return formatMerkleDigest(hasher.digest('hex'));
  }

  getUpdatedHashes(): [Array<string>, Array<string>] {
    return [this.changedHash, this.newFiles];
  }

  emptyUpdatedHashes(): void {
    this.changedHash = [];
    this.newFiles = [];
  }

  loadMerkleIndex(filePath: string): boolean {
    return this.merkleIndex.loadFromFile(filePath);
  }

  saveMerkleIndex(filePath: string): void {
    this.merkleIndex.saveToFile(filePath);
  }

  /** @deprecated Prefer saveMerkleIndex; kept for API compatibility. */
  updateHashJSON(): void {
    // no-op — merkle nodes persist via saveMerkleIndex
  }
}

export default Hasher;
