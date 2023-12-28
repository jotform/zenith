import workerpool from 'workerpool';
import { execSync } from 'child_process';
import CacherFactory from './classes/Cache/CacheFactory';
import { Readable } from 'stream';
import Logger from './utils/logger';
import { ROOT_PATH } from './utils/constants';
import { readableToBuffer } from './utils/functions';
import { configManagerInstance } from './config';
import { ExecError } from './types/BuildTypes';
import HybridCacher from './classes/Cache/HybridCacher';

const execute = async (buildPath: string, targetCommand: string, hash: string, root: string, outputs: Array<string>, projectName: string, requiredFiles: string[] | undefined, noCache = false): Promise<{[output: string]: string} | Error> => {
  try {
    const cacher = CacherFactory.getCacher();
    if (buildPath === undefined) throw new Error('Build path is undefined while trying to build!');
    const project = buildPath.split('/').pop();
    if (project === undefined) throw new Error('Could not read build path in execute method!');
    workerpool.workerEmit(`Running ${targetCommand} command for => ${project}`);
    const commandOutput = execSync(`pnpm --filter ${projectName} ${targetCommand}`, { cwd: ROOT_PATH, encoding: 'utf-8' });
    if (noCache) return { output: commandOutput };
    await Promise.all(outputs.map(output => cacher.cache(hash, root, output, targetCommand, commandOutput, requiredFiles)));
    await Promise.all(outputs.map(output => cacher.sendOutputHash(hash, root, output, targetCommand)));
    if (!configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) {
      workerpool.workerEmit(`Files cached ${root}`);
    }
    return { output: commandOutput };
  } catch (error) {
    if (error && typeof error === 'object' && 'stderr' in error) {
      const execErr = error as ExecError;
      Logger.log(2, 'ERR-W-E-1 :: output => ', execErr.stdout);
      return execErr;
    }
    Logger.log(2, 'ERR-W-E-3 :: output => ', error);
    return new Error(String(error));
  }
};

const anotherJob = async (hash: string, root: string, output: string, target: string, compareHash: boolean, logAffected: boolean): Promise<boolean | string | Error> => {
  try {
    const cacher = CacherFactory.getCacher();
    const outputHash = await cacher.recoverFromCache(hash, root, output, target, logAffected);
    if (outputHash === 'Cache not found') return outputHash;
    // if the cacher is hybrid, then cache the output to the other cacher
    if (cacher.isHybrid()) {
      const hybridCacher = cacher as HybridCacher;
      await hybridCacher.cacheToOther(hash, root, output, target, outputHash);
    }
    workerpool.workerEmit(`Cache recovered ${root}`);
    if (!compareHash) return true;
    const remoteHashReadable = await cacher.checkHashes(hash, root, output, target);
    if (typeof outputHash !== 'string') throw new Error('Output hash is not string while recovering from cache!');
    if (!(remoteHashReadable instanceof Readable)) throw new Error('Remote hash is not string while recovering from cache!');
    const remoteHash = (await readableToBuffer(remoteHashReadable)).toString('utf-8');
    workerpool.workerEmit(outputHash === remoteHash ? `Hash hit for ${root}` : `Hashes mismatched for ${root},  ${outputHash} !== ${remoteHash}`);
    return remoteHash === outputHash;
  } catch (error) {
    if (error && typeof error === 'object' && 'stderr' in error) {
      const execErr = error as ExecError;
      Logger.log(2, 'ERR-W-A :: output => ', execErr.stderr);
      return execErr;
    }
    Logger.log(2, 'ERR-W-A :: output => ', error);
    return new Error(String(error));
  }
};

workerpool.worker({
  execute: execute,
  anotherJob: anotherJob
});
