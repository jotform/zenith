import { createWriteStream } from 'fs';
import { randomBytes } from 'crypto';
import * as fsp from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import extract from 'extract-zip';
import Zipper from '../../Zipper';
import Logger from '../../../utils/logger';
import AbstractCacheFormat, { CacheDirectoryParams, RecoverDirectoryParams } from './AbstractCacheFormat';

export default class ZipCacheFormat extends AbstractCacheFormat {
  readonly name = 'zip' as const;

  async cacheDirectory({
    cachePath,
    output,
    directoryPath,
  }: CacheDirectoryParams): Promise<void> {
    const zipped = await Zipper.zip(directoryPath);
    zipped.compress();
    const body = zipped.stream();
    await this.context.putObject({
      Key: `${cachePath}/${output}.zip`,
      Body: body,
    });
    Logger.log(3, 'Zip Cache successfully stored');
  }

  async recoverDirectory({
    cachePath,
    output,
    outputPath,
  }: RecoverDirectoryParams): Promise<string | 'Cache not found'> {
    try {
      const response = await this.context.getObject({
        Bucket: this.context.getBucketName(),
        Key: `${cachePath}/${output}.zip`,
      });
      return await this.extractZipStreamToOutput(response, outputPath);
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (status === 404) return 'Cache not found';
      throw error;
    }
  }

  async extractZipStreamToOutput(stream: Readable, outputPath: string): Promise<string> {
    const tmpRoot = await fsp.mkdtemp(join(tmpdir(), `zenith-unzip-${randomBytes(4).toString('hex')}-`));
    const tmpZip = join(tmpRoot, 'artifact.zip');
    try {
      await pipeline(stream, createWriteStream(tmpZip));
      await extract(tmpZip, { dir: outputPath });
      return await this.context.hasher.getHash(outputPath);
    } finally {
      await fsp.rm(tmpRoot, { recursive: true, force: true });
    }
  }
}
