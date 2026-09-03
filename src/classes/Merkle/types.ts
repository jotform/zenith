export const MERKLE_DIGEST_VERSION = 'm1';

export type MerkleNodeKind = 'file' | 'dir';

export interface MerkleNode {
  hash: string;
  mtimeMs: number;
  size: number;
  kind: MerkleNodeKind;
}

export type MerkleNodeMap = Record<string, MerkleNode>;

export interface MerkleIndexPayload {
  version: typeof MERKLE_DIGEST_VERSION;
  nodes: MerkleNodeMap;
}

export interface HasherPerfCounters {
  filesHashed: number;
  filesReused: number;
  bytesRead: number;
}

export function formatMerkleDigest(hex: string): string {
  return `${MERKLE_DIGEST_VERSION}:${hex}`;
}

export function stripMerkleDigestPrefix(digest: string): string {
  const prefix = `${MERKLE_DIGEST_VERSION}:`;
  return digest.startsWith(prefix) ? digest.slice(prefix.length) : digest;
}
