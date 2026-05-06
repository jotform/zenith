import { createReadStream, createWriteStream } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import path = require('path');
import Logger from '../../../utils/logger';
import AbstractCacheFormat, { CacheDirectoryParams, RecoverDirectoryParams } from './AbstractCacheFormat';
import { listFilesRecursively } from './directoryStats';
import { getFilesDownloadConcurrency, getFilesUploadConcurrency } from './settings';

type BlobManifestEntry = {
  path: string;
  hash: string;
  size: number;
};

type BlobsCacheManifest = {
  format: 'blobs';
  files: BlobManifestEntry[];
};

const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> => {
  if (items.length === 0) return;
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) break;
      await worker(items[index]);
    }
  });
  await Promise.all(workers);
};

const hashFileSha256Hex = (absolutePath: string): Promise<string> => new Promise((resolve, reject) => {
  const hash = createHash('sha256');
  const rs = createReadStream(absolutePath);
  rs.on('error', reject);
  rs.on('data', (chunk: Buffer) => hash.update(chunk));
  rs.on('end', () => resolve(hash.digest('hex')));
});

export default class BlobsCacheFormat extends AbstractCacheFormat {
  readonly name = 'blobs' as const;

  async cacheDirectory({
    cachePath,
    output,
    directoryPath,
  }: CacheDirectoryParams): Promise<void> {
    const blobPrefix = `${cachePath}/${output}/blobs`;
    const manifestKey = `${cachePath}/${output}.manifest.json`;
    const fileList = await listFilesRecursively(directoryPath);
    const manifest: BlobsCacheManifest = {
      format: 'blobs',
      files: [],
    };

    const hashByPath = new Map<string, { hash: string; size: number }>();
    await runWithConcurrency(fileList, getFilesUploadConcurrency(), async (file) => {
      const digest = await hashFileSha256Hex(file.absolutePath);
      hashByPath.set(file.relativePath, { hash: digest, size: file.size });
    });

    const uploaded = new Set<string>();
    await runWithConcurrency(fileList, getFilesUploadConcurrency(), async (file) => {
      const { hash: digest } = hashByPath.get(file.relativePath) as { hash: string; size: number };
      const blobKey = `${blobPrefix}/${digest}`;
      if (!uploaded.has(digest)) {
        uploaded.add(digest);
        await this.context.putObject({
          Key: blobKey,
          Body: createReadStream(file.absolutePath),
        });
      }
    });

    for (const file of fileList) {
      const meta = hashByPath.get(file.relativePath) as { hash: string; size: number };
      manifest.files.push({
        path: file.relativePath,
        hash: meta.hash,
        size: meta.size,
      });
    }

    await this.context.putObject({
      Key: manifestKey,
      Body: Buffer.from(JSON.stringify(manifest)),
    });
    Logger.log(3, 'Blob-addressed cache successfully stored');
  }

  async recoverDirectory({
    cachePath,
    output,
    outputPath,
  }: RecoverDirectoryParams): Promise<string | 'Cache not found'> {
    const manifestKey = `${cachePath}/${output}.manifest.json`;
    const blobPrefix = `${cachePath}/${output}/blobs`;
    const bucketName = this.context.getBucketName();

    let manifestBody: Readable;
    try {
      manifestBody = await this.context.getObject({
        Bucket: bucketName,
        Key: manifestKey,
      });
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (status === 404) return 'Cache not found';
      throw error;
    }

    const manifestJson = await this.context.txtPipeEnd(manifestBody);
    const manifest = JSON.parse(manifestJson) as BlobsCacheManifest;
    if (manifest.format !== 'blobs' || !Array.isArray(manifest.files)) {
      return 'Cache not found';
    }

    await rm(outputPath, { recursive: true, force: true });
    await mkdir(outputPath, { recursive: true });

    await runWithConcurrency(manifest.files, getFilesDownloadConcurrency(), async (file) => {
      const objectStream = await this.context.getObject({
        Bucket: bucketName,
        Key: `${blobPrefix}/${file.hash}`,
      });
      const targetFilePath = path.join(outputPath, ...file.path.split('/'));
      await mkdir(path.dirname(targetFilePath), { recursive: true });
      await pipeline(objectStream, createWriteStream(targetFilePath));
    });

    return this.context.hasher.getHash(outputPath);
  }
}
