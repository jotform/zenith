import { createReadStream, createWriteStream } from 'fs';
import { randomBytes } from 'crypto';
import * as fsp from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as tar from 'tar';
import Logger from '../../../utils/logger';
import AbstractCacheFormat, { CacheDirectoryParams, RecoverDirectoryParams } from './AbstractCacheFormat';

export default class TarCacheFormat extends AbstractCacheFormat {
  readonly name = 'tar' as const;

  async cacheDirectory({
    cachePath,
    output,
    directoryPath,
  }: CacheDirectoryParams): Promise<void> {
    const names = await fsp.readdir(directoryPath);
    if (names.length === 0) {
      await this.context.putObject({
        Key: `${cachePath}/${output}.tar`,
        Body: Buffer.alloc(0),
      });
      Logger.log(3, 'Empty tar cache stored');
      return;
    }
    const tmpTar = join(tmpdir(), `zenith-tar-${randomBytes(8).toString('hex')}.tar`);
    try {
      await tar.c(
        {
          file: tmpTar,
          cwd: directoryPath,
          gzip: false,
          portable: true,
        },
        names,
      );
      const rs = createReadStream(tmpTar);
      try {
        await this.context.putObject({
          Key: `${cachePath}/${output}.tar`,
          Body: rs,
        });
      } finally {
        rs.destroy();
      }
    } finally {
      await fsp.unlink(tmpTar).catch(() => undefined);
    }
    Logger.log(3, 'Tar cache successfully stored');
  }

  async recoverDirectory({
    cachePath,
    output,
    outputPath,
  }: RecoverDirectoryParams): Promise<string | 'Cache not found'> {
    try {
      const response = await this.context.getObject({
        Bucket: this.context.getBucketName(),
        Key: `${cachePath}/${output}.tar`,
      });
      return await this.extractTarStreamToOutput(response, outputPath);
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (status === 404) return 'Cache not found';
      throw error;
    }
  }

  async extractTarStreamToOutput(stream: Readable, outputPath: string): Promise<string> {
    const tmpRoot = await fsp.mkdtemp(join(tmpdir(), `zenith-untar-${randomBytes(4).toString('hex')}-`));
    const tmpTar = join(tmpRoot, 'artifact.tar');
    try {
      await pipeline(stream, createWriteStream(tmpTar));
      const st = await fsp.stat(tmpTar);
      if (st.size === 0) {
        await fsp.mkdir(outputPath, { recursive: true });
        return this.context.hasher.getHash(outputPath);
      }
      await fsp.mkdir(outputPath, { recursive: true });
      await tar.x({
        file: tmpTar,
        cwd: outputPath,
        gzip: false,
      });
      return this.context.hasher.getHash(outputPath);
    } finally {
      await fsp.rm(tmpRoot, { recursive: true, force: true });
    }
  }
}
