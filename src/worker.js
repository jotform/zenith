import workerpool from 'workerpool';
import { execSync } from 'child_process';
import RemoteCacher from './classes/RemoteCacher';
import Logger from './utils/logger'
import { ROOT_PATH } from './utils/constants';

const execute = async (buildPath, targetCommand, hash, root, outputs, projectName) => {
  try {
    workerpool.workerEmit(`Running ${targetCommand} command for => ${buildPath.split('/').pop()}`);
    // TODO: anything better than substr
    const commandOutput = execSync(`pnpm --filter ${projectName} ${targetCommand}`, { cwd: ROOT_PATH, encoding: 'utf-8' });
    await Promise.all(outputs.map(output => RemoteCacher.cache(hash, root, output, targetCommand, commandOutput)));
    await Promise.all(outputs.map(output => RemoteCacher.sendOutputHash(hash, root, output, targetCommand)));
    if (!process.env.ZENITH_READ_ONLY) {
      workerpool.workerEmit(`Files cached ${root}`);
    }
    return { output: commandOutput };
  } catch (error) {
    Logger.log(2, error, 'IN EXECUTE TARGET');
    return error;
  }
}

const anotherJob = async (hash, root, output, target, compareHash) => {
  try {
    const outputHash = await RemoteCacher.recoverFromCache(hash, root, output, target);
    workerpool.workerEmit(`Cache recovered ${root}`);
    if (!compareHash) return true;
    const remoteHash = await RemoteCacher.checkHashes(hash, root, output, target);
    workerpool.workerEmit(outputHash === remoteHash ? `Hash hit for ${root}` : `Hashes mismatched for ${root},  ${outputHash} !== ${remoteHash}`);
    return remoteHash === outputHash;
  } catch (error) {
    Logger.log(2, error, 'IN RECOVERING CACHE');
    return error;
  }
}

workerpool.worker({
  execute: execute,
  anotherJob: anotherJob
});
