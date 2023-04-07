import workerpool from 'workerpool';
import { execSync } from 'child_process';
import RemoteCacher from './classes/RemoteCacher';
import Logger from './utils/logger';
import { ROOT_PATH } from './utils/constants';

const execute = async (buildPath: string, targetCommand: string, hash: string, root: string, outputs: Array<string>, projectName: string) => {
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
    console.log('type of error:::', typeof error);
    if (error instanceof Error) Logger.log(2, 'ERR-W-E :: output => ', error.message);
    else Logger.log(2, 'ERR-W-E :: output => ', error);
    return error;
  }
};

const anotherJob = async (hash: string, root: string, output: string, target: string, compareHash: boolean, logAffected: boolean) => {
  try {
    const outputHash = await RemoteCacher.recoverFromCache(hash, root, output, target, logAffected);
    workerpool.workerEmit(`Cache recovered ${root}`);
    if (!compareHash) return true;
    const remoteHash = await RemoteCacher.checkHashes(hash, root, output, target);
    workerpool.workerEmit(outputHash === remoteHash ? `Hash hit for ${root}` : `Hashes mismatched for ${root},  ${outputHash} !== ${remoteHash}`);
    return remoteHash === outputHash;
  } catch (error) {
    if (error instanceof Error) Logger.log(2, 'ERR-W-A :: output => ', error.message);
    else Logger.log(2, 'ERR-W-A :: output => ', error);
    return error;
  }
};

workerpool.worker({
  execute: execute,
  anotherJob: anotherJob
});
