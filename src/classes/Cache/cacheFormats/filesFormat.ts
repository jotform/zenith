import { createReadStream, createWriteStream } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as fsp from 'fs/promises';
import path = require('path');
import Logger from '../../../utils/logger';
import AbstractCacheFormat, { CacheDirectoryParams, RecoverDirectoryParams } from './AbstractCacheFormat';
import { listFilesRecursively } from './directoryStats';
import { getFilesDownloadConcurrency, getFilesInlineMaxBytes, getFilesUploadConcurrency } from './settings';

type CachedFileEntry = {
  path: string;
  size: number;
};

type FilesCacheManifest = {
  format: 'files';
  files: CachedFileEntry[];
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

export default class FilesCacheFormat extends AbstractCacheFormat {
  readonly name = 'files' as const;

  async cacheDirectory({
    cachePath,
    output,
    directoryPath,
  }: CacheDirectoryParams): Promise<void> {
    const filePrefix = `${cachePath}/${output}/files`;
    const manifestKey = `${cachePath}/${output}.manifest.json`;
    const fileList = await listFilesRecursively(directoryPath);
    const manifest: FilesCacheManifest = {
      format: 'files',
      files: fileList.map((file) => ({
        path: file.relativePath,
        size: file.size,
      })),
    };

    const inlineMax = getFilesInlineMaxBytes();

    await runWithConcurrency(fileList, getFilesUploadConcurrency(), async (file) => {
      const key = `${filePrefix}/${file.relativePath}`;
      const body = file.size <= inlineMax
        ? await fsp.readFile(file.absolutePath)
        : createReadStream(file.absolutePath);
      await this.context.putObject({
        Key: key,
        Body: body,
      });
    });

    await this.context.putObject({
      Key: manifestKey,
      Body: Buffer.from(JSON.stringify(manifest)),
    });
    Logger.log(3, 'File-based cache successfully stored');
  }

  async recoverDirectory({
    cachePath,
    output,
    outputPath,
  }: RecoverDirectoryParams): Promise<string | 'Cache not found'> {
    const manifestKey = `${cachePath}/${output}.manifest.json`;
    const filesPrefix = `${cachePath}/${output}/files`;
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
    const manifest = JSON.parse(manifestJson) as FilesCacheManifest;
    if (manifest.format !== 'files' || !Array.isArray(manifest.files)) {
      return 'Cache not found';
    }

    await rm(outputPath, { recursive: true, force: true });
    await mkdir(outputPath, { recursive: true });

    await runWithConcurrency(manifest.files, getFilesDownloadConcurrency(), async (file) => {
      const objectStream = await this.context.getObject({
        Bucket: bucketName,
        Key: `${filesPrefix}/${file.path}`,
      });
      const targetFilePath = path.join(outputPath, ...file.path.split('/'));
      await mkdir(path.dirname(targetFilePath), { recursive: true });
      await pipeline(objectStream, createWriteStream(targetFilePath));
    });

    return this.context.hasher.getHash(outputPath);
  }
}
