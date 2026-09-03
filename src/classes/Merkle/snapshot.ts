import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { MERKLE_DIGEST_VERSION, MerkleIndexPayload } from './types';

export interface ZenithSnapshot {
  version: typeof MERKLE_DIGEST_VERSION;
  target: string;
  createdAt: string;
  workspace: Record<string, string[]>;
  merkle: MerkleIndexPayload;
  projectHashes?: Record<string, string>;
}

export function workspaceMapToRecord(workspace: Map<string, Set<string>>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [project, deps] of workspace.entries()) {
    out[project] = Array.from(deps).sort();
  }
  return out;
}

export function workspaceRecordToMap(workspace: Record<string, string[]>): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [project, deps] of Object.entries(workspace || {})) {
    map.set(project, new Set(deps));
  }
  return map;
}

export function writeZenithSnapshot(filePath: string, snapshot: ZenithSnapshot): void {
  const dir = path.dirname(filePath);
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2), { encoding: 'utf-8' });
}

export function readZenithSnapshot(filePath: string): ZenithSnapshot {
  if (!existsSync(filePath)) {
    throw new Error(`Zenith snapshot not found: ${filePath}`);
  }
  const raw = JSON.parse(readFileSync(filePath, { encoding: 'utf-8' })) as ZenithSnapshot;
  if (!raw || raw.version !== MERKLE_DIGEST_VERSION) {
    throw new Error(`Unsupported or missing Zenith snapshot version in ${filePath}`);
  }
  if (!raw.workspace || !raw.merkle) {
    throw new Error(`Invalid Zenith snapshot (missing workspace/merkle): ${filePath}`);
  }
  return raw;
}
