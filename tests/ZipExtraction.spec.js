import { mkdtempSync, writeFileSync, readFileSync, rmSync, statSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { crc32 } from 'zlib';
import JSZip from 'jszip';
import { extractZipFileToDir } from '../src/classes/Cache/cacheFormats/zipExtract';

// Hand-build a STORED (uncompressed) zip with a verbatim entry name. JSZip
// normalises `..` away, so to exercise the Zip Slip guard we craft the bytes
// directly (local file header + central directory + end-of-central-directory).
const makeStoredZipBuffer = (name, content) => {
  const nameBuf = Buffer.from(name, 'utf8');
  const data = Buffer.from(content, 'utf8');
  const crc = crc32(data) >>> 0;
  const size = data.length;
  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0); lfh.writeUInt16LE(20, 4);
  lfh.writeUInt32LE(crc, 14); lfh.writeUInt32LE(size, 18); lfh.writeUInt32LE(size, 22);
  lfh.writeUInt16LE(nameBuf.length, 26);
  const local = Buffer.concat([lfh, nameBuf, data]);
  const cdh = Buffer.alloc(46);
  cdh.writeUInt32LE(0x02014b50, 0); cdh.writeUInt16LE(20, 4); cdh.writeUInt16LE(20, 6);
  cdh.writeUInt32LE(crc, 16); cdh.writeUInt32LE(size, 20); cdh.writeUInt32LE(size, 24);
  cdh.writeUInt16LE(nameBuf.length, 28);
  const central = Buffer.concat([cdh, nameBuf]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, eocd]);
};

// Build a DEFLATE-compressed zip buffer from in-memory entries.
// entries: [{ name, content, unixMode? }]
const makeZipBuffer = async (entries) => {
  const zip = new JSZip();
  for (const e of entries) {
    zip.file(e.name, e.content, e.unixMode ? { unixPermissions: e.unixMode } : undefined);
  }
  return zip.generateAsync({
    type: 'nodebuffer',
    platform: 'UNIX',            // so unixPermissions land in externalFileAttributes
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

describe('extractZipFileToDir', () => {
  let workDir;
  beforeEach(() => { workDir = mkdtempSync(join(tmpdir(), 'zenith-ziptest-')); });
  afterEach(() => { rmSync(workDir, { recursive: true, force: true }); });

  it('extracts nested files and preserves directory structure', async () => {
    const buf = await makeZipBuffer([
      { name: 'a.txt', content: 'hello' },
      { name: 'nested/b.txt', content: 'world' },
    ]);
    const zipPath = join(workDir, 'in.zip');
    writeFileSync(zipPath, buf);
    const outDir = join(workDir, 'out');
    await extractZipFileToDir(zipPath, outDir);
    expect(readFileSync(join(outDir, 'a.txt'), 'utf8')).toBe('hello');
    expect(readFileSync(join(outDir, 'nested', 'b.txt'), 'utf8')).toBe('world');
  });

  it('preserves the executable bit on POSIX', async () => {
    if (process.platform === 'win32') return;
    const buf = await makeZipBuffer([{ name: 'run.sh', content: '#!/bin/sh\necho hi\n', unixMode: 0o755 }]);
    const zipPath = join(workDir, 'exec.zip');
    writeFileSync(zipPath, buf);
    const outDir = join(workDir, 'out');
    await extractZipFileToDir(zipPath, outDir);
    const mode = statSync(join(outDir, 'run.sh')).mode & 0o777;
    expect(mode & 0o100).toBe(0o100); // owner-executable bit set
  });

  it('extracts a >1.4MB DEFLATE entry without hanging (Node 24.16 deadlock guard)', async () => {
    // 4MB of deterministic pseudo-random bytes → a large deflate stream and a
    // 4MB inflate output: the exact condition that deadlocked yauzl@2 under Node 24.16.
    const big = Buffer.alloc(4 * 1024 * 1024);
    let seed = 12345;
    for (let i = 0; i < big.length; i += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      big[i] = seed & 0xff;
    }
    const buf = await makeZipBuffer([{ name: 'big.bin', content: big }]);
    const zipPath = join(workDir, 'big.zip');
    writeFileSync(zipPath, buf);
    const outDir = join(workDir, 'out');
    await extractZipFileToDir(zipPath, outDir);
    const extracted = readFileSync(join(outDir, 'big.bin'));
    expect(extracted.length).toBe(big.length);
    expect(extracted.equals(big)).toBe(true);
  }, 20000); // explicit timeout: a hang fails the suite instead of hanging forever

  it('rejects a Zip Slip entry and writes nothing outside the output dir', async () => {
    const zipPath = join(workDir, 'evil.zip');
    // entry escapes one level above outDir, into workDir
    writeFileSync(zipPath, makeStoredZipBuffer('../escaped.txt', 'pwned'));
    const outDir = join(workDir, 'out');
    await expect(extractZipFileToDir(zipPath, outDir)).rejects.toThrow();
    expect(existsSync(join(workDir, 'escaped.txt'))).toBe(false);
    expect(existsSync(join(outDir, 'escaped.txt'))).toBe(false);
  });

  it('rejects an absolute-path entry', async () => {
    const zipPath = join(workDir, 'abs.zip');
    writeFileSync(zipPath, makeStoredZipBuffer('/tmp/zenith-should-not-exist.txt', 'pwned'));
    const outDir = join(workDir, 'out');
    await expect(extractZipFileToDir(zipPath, outDir)).rejects.toThrow();
  });
});
