import { DebugJSON } from '../../types/ConfigTypes';
import { Readable } from 'stream';
import Logger from '../../utils/logger';
import { configManagerInstance } from '../../config';
import path = require('path');
import { ROOT_PATH } from '../../utils/constants';
import { existsSync } from 'fs';
import { stat, rm, mkdir } from 'fs/promises';
import { getMissingRequiredFiles, isOutputTxt } from '../../utils/functions';
import Hasher from './../Hasher';
import { NodeSystemError } from '../../types/BuildTypes';
import FilesCacheFormat from './cacheFormats/filesFormat';
import BlobsCacheFormat from './cacheFormats/blobsFormat';
import TarCacheFormat from './cacheFormats/tarFormat';
import type { ConcreteCacheFormat } from './cacheFormats/settings';
import {
  LEGACY_MULTI_FORMAT_PROBE_ORDER,
  getFormatsToProbeForLayoutPath,
  resolveEffectiveConcreteFormat,
} from './cacheFormats/settings';
import { deriveCacheLayoutHash } from './cacheFormats/cacheLayoutHash';
import ZipCacheFormat from './cacheFormats/zipFormat';

const getFormatContext = (cacher: Cacher) => ({
  putObject: cacher.putObject.bind(cacher),
  getObject: cacher.getObject.bind(cacher),
  txtPipeEnd: cacher.txtPipeEnd.bind(cacher),
  hasher: cacher.hasher,
  getBucketName: () => configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
});

const getZipFormat = (cacher: Cacher): ZipCacheFormat => new ZipCacheFormat(getFormatContext(cacher));

const getFilesFormat = (cacher: Cacher): FilesCacheFormat => new FilesCacheFormat(getFormatContext(cacher));

const getTarFormat = (cacher: Cacher): TarCacheFormat => new TarCacheFormat(getFormatContext(cacher));

const getBlobsFormat = (cacher: Cacher): BlobsCacheFormat => new BlobsCacheFormat(getFormatContext(cacher));

const getFormatByName = (cacher: Cacher, name: ConcreteCacheFormat) => {
  switch (name) {
    case 'files':
      return getFilesFormat(cacher);
    case 'tar':
      return getTarFormat(cacher);
    case 'blobs':
      return getBlobsFormat(cacher);
    default:
      return getZipFormat(cacher);
  }
};

export default abstract class Cacher {
  cachePath = '';
  hasher = new Hasher();

  abstract putObject({Bucket, Key, Body}: {Bucket?: string, Key: string, Body: Buffer | string | Readable}): Promise<void>
  abstract getObject({Bucket, Key}: {Bucket?: string,Key: string}): Promise<Readable>

  isHybrid() {
    return false;
  }

  isDebug() {
    return configManagerInstance.getConfigValue('ZENITH_DEBUG');
  }
  
  callback({
    successMessage,
    resolve,
    reject
  } : {
    successMessage: string,
    resolve?: (value: void | PromiseLike<void>) => void,
    reject?: (reason?: unknown) => void
  }) {
    return (err: Error | null) => {
      if (err) {
        Logger.log(2, err);
        if (reject) reject(err);
      }
      Logger.log(3, successMessage);
      if (resolve) resolve();
    };
  }

  abstract getDebugFile(compareWith: string, target: string, debugLocation: string): Promise<Record<string, string>>
  abstract updateDebugFile(debugJSON: DebugJSON, target: string, debugLocation: string): void

  sendOutputHash(hash: string, root: string, output: string, target: string): Promise<void> | undefined {
    if (configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) return;
    return (async () => {
      try {
        const directoryPath = path.join(ROOT_PATH, root, !isOutputTxt(output) ? output : '');
        if (!existsSync(directoryPath)) {
          return;
        }
        let resolvedPath: string;
        if (isOutputTxt(output)) {
          resolvedPath = `${target}/${hash}/${root}`;
        } else {
          const fmt = await resolveEffectiveConcreteFormat(directoryPath);
          resolvedPath = `${target}/${deriveCacheLayoutHash(hash, fmt)}/${root}`;
        }
        const outputHash = await this.hasher.getHash(directoryPath);
        const outputBuff = Buffer.from(outputHash);
        await this.putObject({
          Bucket: configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
          Key: `${resolvedPath}/${output}-hash.txt`,
          Body: outputBuff,
        });
        Logger.log(3, 'Hash successfully stored');
      } catch (error) {
        Logger.log(2, error);
        throw error;
      }
    })();
  }

  async cacheZip(cachePath: string, output: string, directoryPath: string) {
    await getZipFormat(this).cacheDirectory({
      cachePath,
      output,
      directoryPath,
    });
  }


  cacheTxt(cachePath: string, output: string, commandOutput: string) {
    return new Promise<void>((resolve, reject) => {
      this.putObject({
        Key: `${cachePath}/${output}.txt`,
        Body: commandOutput
      }).then(() => {
        Logger.log(3, 'Txt Cache successfully stored');
        resolve();
      }).catch((err) => {
        Logger.log(2, err);
        reject(err);
      });
    });
  }

  async cache(hash: string, root: string, output: string, target: string, commandOutput: string, requiredFiles: string[] | undefined) {
    if (configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) return;
    try {
      const directoryPath = path.join(ROOT_PATH, root, output);
      if (output !== 'stdout' && !existsSync(directoryPath)) {
        return;
      }
      const notFoundFiles = getMissingRequiredFiles(directoryPath, requiredFiles);
      if (notFoundFiles.length > 0) {
        const fileLog = notFoundFiles.reduce((acc, curr) => {
          return `${acc}\n${curr}`;
        }, '');
        throw new Error(`Below required files are not found while building ${root}.\n${fileLog}`);
      }
      if (output === 'stdout') {
        const cachePath = `${target}/${hash}/${root}`;
        if (this.isDebug()) Logger.log(1, `Caching output ${directoryPath} to ${cachePath}`);
        await this.cacheTxt(cachePath, output, commandOutput);
        return;
      }
      const effectiveFormat = await resolveEffectiveConcreteFormat(directoryPath);
      const cachePath = `${target}/${deriveCacheLayoutHash(hash, effectiveFormat)}/${root}`;
      if (this.isDebug()) Logger.log(1, `Caching output ${directoryPath} to ${cachePath}`);
      await getFormatByName(this, effectiveFormat).cacheDirectory({
        cachePath,
        output,
        directoryPath,
      });
    } catch (error) {
      Logger.log(2, error);
      if (error instanceof Error) throw error;
      if (typeof error === 'string') throw new Error(error);
      throw new Error();
    }
  }

  async pipeEnd(stream: Readable, outputPath: string) {
    try {
      return await getZipFormat(this).extractZipStreamToOutput(stream, outputPath);
    } catch (error) {
      Logger.log(2, error);
      throw error;
    }
  }

  txtPipeEnd(stream: Readable): Promise<string> {
    const chunks: Array<Buffer> = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => { chunks.push(Buffer.from(chunk)); });
      stream.on('error', (err: Error) => reject(err));
      stream.on('end', () => {
        const output = Buffer.concat(chunks).toString('utf8');
        resolve(output);
      });
    });
  }

  async recoverFromCache(originalHash: string, root: string, output: string, target: string, logAffected: boolean): Promise<string | boolean | void> {
    const isStdOut = isOutputTxt(output);
    try {
      const outputPath = path.join(ROOT_PATH, root, output);
      if (isStdOut) {
        const cachePath = `${target}/${originalHash}/${root}`;
        const remotePath = `${cachePath}/${output}.txt`;
        const response = await this.getObject({
          Bucket: configManagerInstance.getConfigValue('S3_BUCKET_NAME'),
          Key: remotePath
        });
        if (response === undefined) throw new Error('Error while recovering from cache: S3 Response Body is undefined');
        const stdout = await this.txtPipeEnd(response);
        if (!logAffected) Logger.log(2, stdout);
        return stdout;
      }
      try {
        const stats = await stat(outputPath);
        if (stats.isDirectory()) {
          await rm(outputPath, { recursive: true, force: true });
          await mkdir(outputPath);
        }
      } catch (err) {
        const nodeError = err as NodeSystemError;
        if (nodeError.code !== 'ENOENT') {
          Logger.log(2, err);
          throw err;
        }
        await mkdir(outputPath);
      }
      for (const fmt of getFormatsToProbeForLayoutPath()) {
        const layoutHash = deriveCacheLayoutHash(originalHash, fmt);
        const cachePath = `${target}/${layoutHash}/${root}`;
        const recoveredHash = await getFormatByName(this, fmt).recoverDirectory({
          cachePath,
          output,
          outputPath,
        });
        if (recoveredHash !== 'Cache not found') {
          return recoveredHash;
        }
      }
      const legacyPath = `${target}/${originalHash}/${root}`;
      for (const fmt of LEGACY_MULTI_FORMAT_PROBE_ORDER) {
        const recoveredHash = await getFormatByName(this, fmt).recoverDirectory({
          cachePath: legacyPath,
          output,
          outputPath,
        });
        if (recoveredHash !== 'Cache not found') {
          return recoveredHash;
        }
      }
      return 'Cache not found';
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (status === 404) {
        return 'Cache not found';
      }
      Logger.log(2, "ERR-C-R ::", error);
      throw error;
    }
  }

  async checkHashes(hash: string, root: string, output: string, target: string): Promise<Readable | undefined> {
    const bucket = configManagerInstance.getConfigValue('S3_BUCKET_NAME');
    if (isOutputTxt(output)) {
      try {
        const response = await this.getObject({
          Bucket: bucket,
          Key: `${target}/${hash}/${root}/${output}-hash.txt`,
        });
        if (response === undefined) throw new Error('Error while checking hashes: S3 Response Body is undefined');
        return response;
      } catch (error) {
        Logger.log(2, error);
        return undefined;
      }
    }
    for (const fmt of getFormatsToProbeForLayoutPath()) {
      const layoutHash = deriveCacheLayoutHash(hash, fmt);
      try {
        const response = await this.getObject({
          Bucket: bucket,
          Key: `${target}/${layoutHash}/${root}/${output}-hash.txt`,
        });
        if (response === undefined) throw new Error('Error while checking hashes: S3 Response Body is undefined');
        return response;
      } catch (error) {
        Logger.log(2, error);
      }
    }
    try {
      const response = await this.getObject({
        Bucket: bucket,
        Key: `${target}/${hash}/${root}/${output}-hash.txt`,
      });
      if (response === undefined) throw new Error('Error while checking hashes: S3 Response Body is undefined');
      return response;
    } catch (error) {
      Logger.log(2, error);
    }
    return undefined;
  }

}
