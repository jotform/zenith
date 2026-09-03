import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { ROOT_PATH } from '../../utils/constants';
import {
  MERKLE_DIGEST_VERSION,
  MerkleIndexPayload,
  MerkleNode,
  MerkleNodeMap,
} from './types';

export const MERKLE_INDEX_DIR = path.join(ROOT_PATH, '.zenith', 'merkle');

export function merkleIndexPathForTarget(target: string): string {
  const safe = target.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return path.join(MERKLE_INDEX_DIR, `${safe}.json`);
}

export class MerkleIndex {
  nodes: MerkleNodeMap = {};

  clear(): void {
    this.nodes = {};
  }

  get(relPath: string): MerkleNode | undefined {
    return this.nodes[relPath];
  }

  set(relPath: string, node: MerkleNode): void {
    this.nodes[relPath] = node;
  }

  serialize(): MerkleIndexPayload {
    return {
      version: MERKLE_DIGEST_VERSION,
      nodes: { ...this.nodes },
    };
  }

  deserialize(payload: MerkleIndexPayload | null | undefined): void {
    if (!payload || payload.version !== MERKLE_DIGEST_VERSION || !payload.nodes) {
      this.nodes = {};
      return;
    }
    this.nodes = { ...payload.nodes };
  }

  loadFromFile(filePath: string): boolean {
    if (!existsSync(filePath)) {
      this.clear();
      return false;
    }
    try {
      const raw = JSON.parse(readFileSync(filePath, { encoding: 'utf-8' })) as MerkleIndexPayload;
      this.deserialize(raw);
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  saveToFile(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(this.serialize()), { encoding: 'utf-8' });
  }

  static toRelPath(absolutePath: string): string {
    const rel = path.relative(ROOT_PATH, absolutePath);
    return rel.split(path.sep).join('/');
  }
}

export default MerkleIndex;
