import { Readable } from 'stream';
import Hasher from '../../Hasher';

export type CacheFormatName = 'zip' | 'files' | 'tar' | 'blobs';

export type CacheFormatContext = {
  putObject: (params: { Key: string; Body: Buffer | string | Readable }) => Promise<void>;
  getObject: (params: { Bucket?: string; Key: string }) => Promise<Readable>;
  txtPipeEnd: (stream: Readable) => Promise<string>;
  hasher: Hasher;
  getBucketName: () => string;
};

export type CacheDirectoryParams = {
  cachePath: string;
  output: string;
  directoryPath: string;
};

export type RecoverDirectoryParams = {
  cachePath: string;
  output: string;
  outputPath: string;
};

export default abstract class AbstractCacheFormat {
  protected context: CacheFormatContext;

  constructor(context: CacheFormatContext) {
    this.context = context;
  }

  abstract readonly name: CacheFormatName;

  abstract cacheDirectory(params: CacheDirectoryParams): Promise<void>;

  abstract recoverDirectory(params: RecoverDirectoryParams): Promise<string | 'Cache not found'>;
}
