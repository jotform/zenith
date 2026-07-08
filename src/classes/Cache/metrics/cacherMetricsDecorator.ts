import { Readable } from 'stream';
import { metricsCollector, nowMs } from '../../../metrics/MetricsCollector';
import { countReadable } from '../../../utils/stream';
import { isReadableStreamBody } from '../../../utils/functions';

type PutObjectParams = { Bucket?: string; Key: string; Body: string | Buffer | Readable };
type GetObjectParams = { Bucket?: string; Key: string };

export type ObjectStoreLike = {
  putObject(params: PutObjectParams): Promise<void>;
  getObject(params: GetObjectParams): Promise<Readable>;
};

/**
 * Wraps a cacher's putObject/getObject to record transfer durations and bytes.
 * Applied to the CONCRETE cachers (Local/Remote/Redis) — HybridCacher delegates
 * cache()/recoverFromCache() straight to its children, so decorating only the
 * outer instance would miss all hybrid traffic.
 */
export const decorateCacherWithMetrics = <T extends ObjectStoreLike>(cacher: T): T => {
  const rawPut = cacher.putObject.bind(cacher);
  const rawGet = cacher.getObject.bind(cacher);
  // eslint-disable-next-line no-param-reassign
  cacher.putObject = async (params: PutObjectParams): Promise<void> => {
    const start = nowMs();
    let bytes = 0;
    let body = params.Body;
    if (typeof body === 'string') bytes = Buffer.byteLength(body);
    else if (Buffer.isBuffer(body)) bytes = body.length;
    // Contract: putObject implementations must fully consume a Readable body
    // before resolving (all current cachers do), so `bytes` is final below.
    else if (isReadableStreamBody(body)) body = countReadable(body, streamed => { bytes = streamed; });
    await rawPut({ ...params, Body: body });
    const end = nowMs();
    metricsCollector.addUpload(end - start, bytes);
    metricsCollector.noteUploadWindow(start, end);
  };
  // eslint-disable-next-line no-param-reassign
  cacher.getObject = async (params: GetObjectParams): Promise<Readable> => {
    const start = nowMs();
    const stream = await rawGet(params);
    // Contract: callers must fully drain the returned stream (all current
    // consumers do), otherwise the end callback never fires and this download's
    // duration/bytes stay unrecorded.
    return countReadable(stream, bytes => {
      const end = nowMs();
      metricsCollector.addDownload(end - start, bytes);
      metricsCollector.noteDownloadWindow(start, end);
    });
  };
  return cacher;
};
