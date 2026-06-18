#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const REDIS_HOST = '127.0.0.1';
const REDIS_PORT = 6379;

const DATA_DIR = path.join('/tmp', 'zenith-redis-data');
const LOG_PATH = path.join('/tmp', 'zenith-redis.log');
const PID_PATH = path.join('/tmp', 'zenith-redis.pid');

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

const pingRedis = () => {
  const result = spawnSync(
    'redis-cli',
    ['-h', REDIS_HOST, '-p', `${REDIS_PORT}`, 'ping'],
    { encoding: 'utf8' },
  );
  return result.stdout?.trim() === 'PONG';
};

const waitForRedisReady = async () => {
  for (let i = 0; i < 60; i += 1) {
    if (pingRedis()) return;
    await sleep(500);
  }
  throw new Error('Redis did not become ready in time');
};

const ensureRedisInstalled = () => {
  const server = spawnSync('redis-server', ['--version'], { stdio: 'ignore' });
  const cli = spawnSync('redis-cli', ['--version'], { stdio: 'ignore' });
  if (server.status !== 0 || cli.status !== 0) {
    throw new Error('Redis is not available in PATH. Install via `brew install redis`.');
  }
};

const startRedis = async () => {
  ensureRedisInstalled();
  await fsp.mkdir(DATA_DIR, { recursive: true });

  if (pingRedis()) {
    process.stdout.write(`Redis already running at redis://${REDIS_HOST}:${REDIS_PORT}\n`);
    return;
  }

  let existingPid = 0;
  try {
    existingPid = Number.parseInt((await fsp.readFile(PID_PATH, 'utf8')).trim(), 10);
  } catch {
    existingPid = 0;
  }

  if (!isProcessRunning(existingPid)) {
    const logFd = fs.openSync(LOG_PATH, 'a');
    const child = spawn(
      'redis-server',
      [
        '--port',
        `${REDIS_PORT}`,
        '--bind',
        REDIS_HOST,
        '--dir',
        DATA_DIR,
        '--save',
        '',
      ],
      {
        detached: true,
        stdio: ['ignore', logFd, logFd],
      },
    );
    child.unref();
    await fsp.writeFile(PID_PATH, `${child.pid}\n`, 'utf8');
  }

  await waitForRedisReady();

  process.stdout.write(`Redis ready at redis://${REDIS_HOST}:${REDIS_PORT}\n`);
};

startRedis().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exit(1);
});
