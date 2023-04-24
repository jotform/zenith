import workerpool from 'workerpool';
import { execSync } from 'child_process';
import RemoteCacher from './classes/RemoteCacher';
import Logger from './utils/logger';
import { ROOT_PATH } from './utils/constants';
import { configManagerInstance } from './config';

const execute = async (buildPath: string, targetCommand: string, hash: string, root: string, outputs: Array<string>, projectName: string): Promise<{[output: string]: string} | Error> => {
  try {
    if (buildPath === undefined) throw new Error('Build path is undefined while trying to build!');
    const project = buildPath.split('/').pop()
    if (project === undefined) throw new Error('Could not read build path in execute method!')
    workerpool.workerEmit(`Running ${targetCommand} command for => ${project}`);
    const commandOutput = execSync(`pnpm --filter ${projectName} ${targetCommand}`, { cwd: ROOT_PATH, encoding: 'utf-8' });
    await Promise.all(outputs.map(output => RemoteCacher.cache(hash, root, output, targetCommand, commandOutput)));
    await Promise.all(outputs.map(output => RemoteCacher.sendOutputHash(hash, root, output, targetCommand)));
    if (!configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) {
      workerpool.workerEmit(`Files cached ${root}`);
    }
    return { output: commandOutput };
  } catch (error) {
    if (error instanceof Error) Logger.log(2, 'ERR-W-E :: output => ', error.message);
    else Logger.log(2, 'ERR-W-E :: output => ', error);
    return new Error(String(error));
  }
};

const anotherJob = async (hash: string, root: string, output: string, target: string, compareHash: boolean, logAffected: boolean): Promise<boolean | Error> => {
  try {
    const outputHash = await RemoteCacher.recoverFromCache(hash, root, output, target, logAffected);
    workerpool.workerEmit(`Cache recovered ${root}`);
    if (!compareHash) return true;
    const remoteHash = await RemoteCacher.checkHashes(hash, root, output, target);
    if (typeof outputHash !== 'string' || typeof remoteHash !== 'string') throw new Error('Output hash or Remote hash is not string while recovering from cache!')
    workerpool.workerEmit(outputHash === remoteHash ? `Hash hit for ${root}` : `Hashes mismatched for ${root},  ${outputHash} !== ${remoteHash}`);
    return remoteHash === outputHash;
  } catch (error) {
    if (error instanceof Error) Logger.log(2, 'ERR-W-A :: output => ', error.message);
    else Logger.log(2, 'ERR-W-A :: output => ', error);
    return new Error(String(error));
  }
};

workerpool.worker({
  execute: execute,
  anotherJob: anotherJob
});
