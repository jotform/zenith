#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const PID_PATH = path.join('/tmp', 'zenith-minio.pid');

const stopMinio = async () => {
  let pid = 0;
  try {
    pid = Number.parseInt((await fs.readFile(PID_PATH, 'utf8')).trim(), 10);
  } catch {
    process.stdout.write('MinIO is not running (pid file missing).\n');
    return;
  }

  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 'SIGTERM');
      process.stdout.write(`Stopped MinIO process ${pid}.\n`);
    } catch {
      process.stdout.write(`MinIO process ${pid} was not running.\n`);
    }
  }

  await fs.rm(PID_PATH, { force: true });
};

stopMinio().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exit(1);
});
