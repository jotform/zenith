import workerpool from 'workerpool';
import { execSync } from 'child_process';
import CacherFactory from './classes/Cache/CacheFactory';
import { Readable } from 'stream';
import Logger from './utils/logger';
import { ROOT_PATH } from './utils/constants';
import { readableToBuffer } from './utils/functions';
import { configManagerInstance } from './config';
import ConfigHelperInstance from './classes/ConfigHelper';
import { ExecError } from './types/BuildTypes';
import HybridCacher from './classes/Cache/HybridCacher';
import { CommandExecutionOutput, CacheRecoveryOutput } from './types';

const execute = async (buildPath: string, targetCommand: string, hash: string, root: string, outputs: Array<string>, projectName: string, requiredFiles: string[] | undefined, noCache = false): Promise<CommandExecutionOutput | Error> => {
  try {
    const cacher = CacherFactory.getCacher();
    if (buildPath === undefined) throw new Error('Build path is undefined while trying to build!');
    const project = buildPath.split('/').pop();
    if (project === undefined) throw new Error('Could not read build path in execute method!');
    workerpool.workerEmit(`Running ${targetCommand} command for => ${project}`);
    const executeStart = process.hrtime();
    const commandOutput = execSync(`pnpm --filter ${projectName} ${targetCommand}`, { cwd: ROOT_PATH, encoding: 'utf-8' });
    const execTime = process.hrtime(executeStart);
    if (noCache) return { output: commandOutput, execTime };
  
    const cacheStart = process.hrtime();
    await Promise.all(outputs.map(output => cacher.cache(hash, root, output, targetCommand, commandOutput, requiredFiles)));
    await Promise.all(outputs.map(output => cacher.sendOutputHash(hash, root, output, targetCommand)));
    const cacheTime = process.hrtime(cacheStart);

    if (!configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) {
      workerpool.workerEmit(`Files cached ${root}`);
    }
    return { output: commandOutput, execTime, cacheTime };
  } catch (error) {
    if (ConfigHelperInstance.onFail) ConfigHelperInstance.onFail(targetCommand, { error, hash, root, outputs, projectName, requiredFiles });
    if (error && typeof error === 'object' && 'stderr' in error) {
      const execErr = error as ExecError;
      Logger.log(2, 'ERR-W-E-1 :: output => ', execErr.stdout);
      throw execErr;
    }
    Logger.log(2, 'ERR-W-E-3 :: output => ', error);
    return new Error(String(error));
  }
};

const anotherJob = async (hash: string, root: string, output: string, target: string, compareHash: boolean, logAffected: boolean): Promise<CacheRecoveryOutput> => {
  try {
    const cacher = CacherFactory.getCacher();
    const start = process.hrtime();
    const outputHash = await cacher.recoverFromCache(hash, root, output, target, logAffected);
    if (outputHash === 'Cache not found') return {result: outputHash, time: process.hrtime(start)};
    // if the cacher is hybrid, then cache the output to the other cacher
    if (cacher.isHybrid()) {
      const hybridCacher = cacher as HybridCacher;
      await hybridCacher.cacheToOther(hash, root, output, target, outputHash);
    }
    workerpool.workerEmit(`Cache recovered ${root}`);
    if (!compareHash) return {result: true, time: process.hrtime(start)};
    const remoteHashReadable = await cacher.checkHashes(hash, root, output, target);
    if (typeof outputHash !== 'string') throw new Error('Output hash is not string while recovering from cache!');
    if (!(remoteHashReadable instanceof Readable)) throw new Error('Remote hash is not string while recovering from cache!');
    const remoteHash = (await readableToBuffer(remoteHashReadable)).toString('utf-8');
    workerpool.workerEmit(outputHash === remoteHash ? `Hash hit for ${root}` : `Hashes mismatched for ${root},  ${outputHash} !== ${remoteHash}`);
    return {result: remoteHash === outputHash, time: process.hrtime(start)};
  } catch (error) {
    if (error && typeof error === 'object' && 'stderr' in error) {
      const execErr = error as ExecError;
      Logger.log(2, 'ERR-W-A :: output => ', execErr.stderr);
      throw execErr;
    }
    Logger.log(2, 'ERR-W-A :: output => ', error);
    throw new Error(String(error));
  }
};

const manual = async (cwd: string, command: string, hash: string) => {
  try {
    const cacher = CacherFactory.getCacher();
    const output = execSync(`pnpm run ${command}`, { cwd, encoding: 'utf-8'});
    await cacher.cache(hash, 'root', 'stdout', command, output, []);
    await cacher.sendOutputHash(hash, 'root', output, command);
    if (!configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) {
      workerpool.workerEmit(`Files cached ${command}`);
    }
    return { output };
  } catch (error) {
    if (error && typeof error === 'object' && 'stderr' in error) {
      const execErr = error as ExecError;
      Logger.log(2, 'ERR-W-A :: output => ', execErr.stdout);
      throw execErr;
    }
    Logger.log(2, 'ERR-W-A :: output => ', error);
    return new Error(String(error));
  }
};

workerpool.worker({
  execute: execute,
  anotherJob: anotherJob,
  manual: manual
});
