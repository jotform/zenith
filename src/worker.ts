import workerpool from 'workerpool';
import { execSync } from 'child_process';
import CacherFactory from './classes/Cache/CacheFactory';
import { Readable } from 'stream';
import { ROOT_PATH } from './utils/constants';
import { readableToBuffer } from './utils/functions';
import { toZenithCommandError } from './utils/errors';
import { hrtimeToMs } from './utils/time';
import { metricsCollector } from './metrics/MetricsCollector';
import { recordOutputStats } from './classes/Cache/metrics/recordOutputStats';
import { configManagerInstance } from './config';
import ConfigHelperInstance from './classes/ConfigHelper';
import HybridCacher from './classes/Cache/HybridCacher';
import { CommandExecutionOutput, CacheRecoveryOutput } from './types';

const execute = async (buildPath: string, targetCommand: string, hash: string, root: string, outputs: Array<string>, projectName: string, requiredFiles: string[] | undefined, noCache = false): Promise<CommandExecutionOutput> => {
  const shellCommand = `pnpm --filter ${projectName} ${targetCommand}`;
  try {
    metricsCollector.reset();
    const cacher = CacherFactory.getCacher();
    if (buildPath === undefined) throw new Error('Build path is undefined while trying to build!');
    const project = buildPath.split('/').pop();
    if (project === undefined) throw new Error('Could not read build path in execute method!');
    workerpool.workerEmit(`Running ${targetCommand} command for => ${project}`);
    const executeStart = process.hrtime();
    const commandOutput = execSync(shellCommand, { cwd: ROOT_PATH, encoding: 'utf-8' });
    const execTime = process.hrtime(executeStart);
    await recordOutputStats(root, outputs, commandOutput);
    if (noCache) return { output: commandOutput, execTime, metrics: metricsCollector.snapshot() };

    const cacheStart = process.hrtime();
    await Promise.all(outputs.map(output => cacher.cache(hash, root, output, targetCommand, commandOutput, requiredFiles)));
    await Promise.all(outputs.map(output => cacher.sendOutputHash(hash, root, output, targetCommand)));
    const cacheTime = process.hrtime(cacheStart);
    // Derive archive time from the transfer WALL span, not the sum of upload
    // durations — parallel (multi-file) uploads would otherwise clamp this to 0.
    metricsCollector.setArchiveMs(Math.max(0, hrtimeToMs(cacheTime) - metricsCollector.getUploadWallMs()));

    if (!configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) {
      workerpool.workerEmit(`Files cached ${root}`);
    }
    return { output: commandOutput, execTime, cacheTime, metrics: metricsCollector.snapshot() };
  } catch (error) {
    if (ConfigHelperInstance.onFail) ConfigHelperInstance.onFail(targetCommand, { error, hash, root, outputs, projectName, requiredFiles });
    throw toZenithCommandError(error, {
      project: projectName, script: targetCommand, command: shellCommand, cwd: ROOT_PATH, phase: 'execute'
    });
  }
};

const anotherJob = async (hash: string, root: string, output: string, target: string, compareHash: boolean, logAffected: boolean): Promise<CacheRecoveryOutput> => {
  try {
    metricsCollector.reset();
    const cacher = CacherFactory.getCacher();
    const start = process.hrtime();
    const outputHash = await cacher.recoverFromCache(hash, root, output, target, logAffected);
    const recoverMs = hrtimeToMs(process.hrtime(start));
    if (outputHash === 'Cache not found') return { result: outputHash, time: process.hrtime(start) };
    // Extract time from the download WALL span, not the sum of parallel downloads.
    metricsCollector.setExtractMs(Math.max(0, recoverMs - metricsCollector.getDownloadWallMs()));
    // if the cacher is hybrid, then cache the output to the other cacher
    if (cacher.isHybrid()) {
      const hybridCacher = cacher as HybridCacher;
      await hybridCacher.cacheToOther(hash, root, output, target, outputHash);
    }
    workerpool.workerEmit(`Cache recovered ${root}`);
    if (!compareHash) return { result: true, time: process.hrtime(start), metrics: metricsCollector.snapshot() };
    const remoteHashReadable = await cacher.checkHashes(hash, root, output, target);
    if (typeof outputHash !== 'string') throw new Error('Output hash is not string while recovering from cache!');
    if (!(remoteHashReadable instanceof Readable)) throw new Error('Remote hash is not string while recovering from cache!');
    const remoteHash = (await readableToBuffer(remoteHashReadable)).toString('utf-8');
    workerpool.workerEmit(outputHash === remoteHash ? `Hash hit for ${root}` : `Hashes mismatched for ${root},  ${outputHash} !== ${remoteHash}`);
    return { result: remoteHash === outputHash, time: process.hrtime(start), metrics: metricsCollector.snapshot() };
  } catch (error) {
    throw toZenithCommandError(error, {
      project: root, script: target, cwd: ROOT_PATH, phase: 'recover'
    });
  }
};

const manual = async (cwd: string, command: string, hash: string): Promise<{ output: string }> => {
  const shellCommand = `pnpm run ${command}`;
  try {
    const cacher = CacherFactory.getCacher();
    const output = execSync(shellCommand, { cwd, encoding: 'utf-8'});
    await cacher.cache(hash, 'root', 'stdout', command, output, []);
    await cacher.sendOutputHash(hash, 'root', output, command);
    if (!configManagerInstance.getConfigValue('ZENITH_READ_ONLY')) {
      workerpool.workerEmit(`Files cached ${command}`);
    }
    return { output };
  } catch (error) {
    throw toZenithCommandError(error, {
      script: command, command: shellCommand, cwd, phase: 'manual'
    });
  }
};

workerpool.worker({
  execute: execute,
  anotherJob: anotherJob,
  manual: manual
});
