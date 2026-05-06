#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const http = require('http');
const { S3, CreateBucketCommand } = require('@aws-sdk/client-s3');

const MINIO_HOST = '127.0.0.1';
const MINIO_PORT = 9000;
const MINIO_CONSOLE_PORT = 9001;
const MINIO_BUCKET = 'zenith-cache';
const MINIO_ACCESS_KEY = 'minioadmin';
const MINIO_SECRET_KEY = 'minioadmin';

const DATA_DIR = path.join('/tmp', 'zenith-minio-data');
const LOG_PATH = path.join('/tmp', 'zenith-minio.log');
const PID_PATH = path.join('/tmp', 'zenith-minio.pid');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isProcessRunning = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitForMinioReady = async () => {
  for (let i = 0; i < 60; i += 1) {
    const ok = await new Promise((resolve) => {
      const req = http.get(
        {
          host: MINIO_HOST,
          port: MINIO_PORT,
          path: '/minio/health/ready',
          timeout: 1000,
        },
        (res) => {
          resolve(res.statusCode === 200);
        },
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await sleep(500);
  }
  throw new Error('MinIO did not become ready in time');
};

const ensureBucket = async () => {
  const s3 = new S3({
    endpoint: `http://${MINIO_HOST}:${MINIO_PORT}`,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: MINIO_ACCESS_KEY,
      secretAccessKey: MINIO_SECRET_KEY,
    },
  });
  try {
    await s3.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
  } catch (error) {
    const name = error && typeof error === 'object' ? error.name : '';
    const status = error && typeof error === 'object' ? error.$metadata?.httpStatusCode : undefined;
    if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists' && status !== 409) {
      throw error;
    }
  }
};

const ensureMinioInstalled = () => {
  const result = spawnSync('minio', ['--help'], { stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error('MinIO binary is not available in PATH. Install via `brew install minio`.');
  }
};

const startMinio = async () => {
  ensureMinioInstalled();
  await fsp.mkdir(DATA_DIR, { recursive: true });

  let existingPid = 0;
  try {
    existingPid = Number.parseInt((await fsp.readFile(PID_PATH, 'utf8')).trim(), 10);
  } catch {
    existingPid = 0;
  }

  if (!isProcessRunning(existingPid)) {
    const logFd = fs.openSync(LOG_PATH, 'a');
    const child = spawn(
      'minio',
      [
        'server',
        DATA_DIR,
        '--address',
        `${MINIO_HOST}:${MINIO_PORT}`,
        '--console-address',
        `${MINIO_HOST}:${MINIO_CONSOLE_PORT}`,
      ],
      {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: {
          ...process.env,
          MINIO_ROOT_USER: MINIO_ACCESS_KEY,
          MINIO_ROOT_PASSWORD: MINIO_SECRET_KEY,
        },
      },
    );
    child.unref();
    await fsp.writeFile(PID_PATH, `${child.pid}\n`, 'utf8');
  }

  await waitForMinioReady();
  await ensureBucket();

  process.stdout.write(
    `MinIO ready at http://${MINIO_HOST}:${MINIO_PORT} (console: http://${MINIO_HOST}:${MINIO_CONSOLE_PORT})\n`,
  );
};

startMinio().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exit(1);
});
