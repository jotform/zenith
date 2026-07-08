import { Readable, Transform } from 'stream';

/** Pipes `source` through a byte-counting Transform; calls `onEnd` exactly once. */
export const countReadable = (source: Readable, onEnd: (bytes: number) => void): Readable => {
  let bytes = 0;
  let reported = false;
  const report = () => {
    if (reported) return;
    reported = true;
    onEnd(bytes);
  };
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(null, chunk);
    },
  });
  counter.on('end', report);
  counter.on('close', report);
  source.on('error', err => counter.destroy(err));
  return source.pipe(counter);
};
