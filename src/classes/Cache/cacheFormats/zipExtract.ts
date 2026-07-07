import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import yauzl from 'yauzl';

/**
 * Streaming zip extraction backed by yauzl@3.3.1+.
 *
 * extract-zip's yauzl@2 stalls mid-entry on >1.4MB deflate entries under Node
 * 24.16, deadlocking recovery workers. yauzl 3.3.1 fixed the stream-destroy /
 * async-iteration regression; we additionally use the safe pattern: lazyEntries,
 * one entry at a time, each read stream fully drained via pipeline before the
 * next readEntry(), never early-destroyed.
 *
 * Zip Slip: with decodeStrings enabled (the default we rely on here), yauzl
 * rejects entries with absolute paths or `..` segments before emitting them —
 * such a zip surfaces as an 'error' on the zipfile and rejects this promise.
 * Do NOT pass `decodeStrings: false`; that would disable that path-traversal
 * guard. ZipExtraction.spec.js locks this behaviour in.
 */
export function extractZipFileToDir(zipPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error('yauzl.open returned no zipfile'));
        return;
      }
      zipfile.on('error', reject);
      zipfile.on('close', () => resolve());
      zipfile.on('entry', (entry: yauzl.Entry) => {
        const dest = join(outputPath, entry.fileName);
        if (entry.fileName.endsWith('/')) {
          mkdir(dest, { recursive: true }).then(() => zipfile.readEntry()).catch(reject);
          return;
        }
        mkdir(dirname(dest), { recursive: true })
          .then(() => {
            zipfile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr || !readStream) {
                reject(streamErr ?? new Error('openReadStream returned no stream'));
                return;
              }
              const mode = (entry.externalFileAttributes >>> 16) & 0o777;
              const writeStream = createWriteStream(dest, mode ? { mode } : {});
              pipeline(readStream, writeStream).then(() => zipfile.readEntry()).catch(reject);
            });
          })
          .catch(reject);
      });
      zipfile.readEntry();
    });
  });
}
