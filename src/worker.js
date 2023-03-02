const workerpool = require('workerpool');
const { execSync } = require('child_process');
const RemoteCacher = require('./RemoteCacher');

const execute = async (buildPath, targetCommand, hash, root, outputs) => {
  try {
    workerpool.workerEmit(`Running ${targetCommand} command for => ${buildPath.split('/').pop()}`);
    const commandOutput = execSync(`pnpm ${targetCommand}`, { cwd: buildPath, encoding: 'utf-8' });
    await Promise.all(outputs.map(output => RemoteCacher.cache(hash, root, output)));
    await Promise.all(outputs.map(output => RemoteCacher.sendOutputHash(hash, root, output)));
    if (!process.env.ZENITH_READ_ONLY) {
      workerpool.workerEmit(`Files cached ${root}`);
    }
    return { output: commandOutput };
  } catch (error) {
    return error;
  }
}

const anotherJob = async (hash, root, output) => {
  try {
    const outputHash = await RemoteCacher.recoverFromCache(hash, root, output); 
    workerpool.workerEmit(`Cache recovered ${root}`);
    const remoteHash = await RemoteCacher.checkHashes(hash, root, output);
    workerpool.workerEmit(outputHash === remoteHash ? `Hash hit for ${root}` : `Hashes mismatched for ${root},  ${outputHash} !== ${remoteHash}`);
    return remoteHash === outputHash;
  } catch (error) {
    console.log(error, 'IN RECOVERING CACHE');
    return error;
  }
}

workerpool.worker({
  execute: execute,
  anotherJob: anotherJob
});