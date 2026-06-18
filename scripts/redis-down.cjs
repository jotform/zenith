#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const PID_PATH = path.join('/tmp', 'zenith-redis.pid');

const stopRedis = async () => {
  let pid = 0;
  try {
    pid = Number.parseInt((await fs.readFile(PID_PATH, 'utf8')).trim(), 10);
  } catch {
    process.stdout.write('Redis is not running (pid file missing).\n');
    return;
  }

  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 'SIGTERM');
      process.stdout.write(`Stopped Redis process ${pid}.\n`);
    } catch {
      process.stdout.write(`Redis process ${pid} was not running.\n`);
    }
  }

  await fs.rm(PID_PATH, { force: true });
};

stopRedis().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exit(1);
});
