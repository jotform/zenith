import workerpool from 'workerpool';
import ConfigHelper from './ConfigHelper';
import Logger from '../utils/logger';
import { BuildConfig } from '../types/ConfigTypes';

export default class WorkerHelper {
  started : Set<string> = new Set();

  pool : workerpool.WorkerPool;

  buildConfigJSON : BuildConfig;

  constructor(command : string, worker : string) {
    const workerConfig: workerpool.WorkerPoolOptions = {
      workerType: 'thread',
      // workerpool sets workers to total cpu - 1 if maxWorkers is undefined.
      ...(worker === 'max' ? {} : { maxWorkers: Number(worker) })
    };
    this.pool = workerpool.pool(`${__dirname}/../worker.js`, workerConfig);
    this.buildConfigJSON = ConfigHelper.buildConfigJSON;
  }

  async execute(buildPath: string, command: string, hash: string, root: string, outputs: Array<string>, projectName: string) : Promise<Record<string, string> | Error> {
    try {
      return await this.pool.exec('execute', [buildPath, command, hash, root, outputs, projectName], {
        on: message => Logger.log(3, message)
      });
    } catch (error) {
      if (error instanceof Error) return error;
      throw new Error('Executing worker failed');
    }
  }

  async anotherJob(hash: string, root: string, output: string, target: string, compareHashes: boolean, logAffected: boolean): Promise<{output: string} | unknown> {
    try {
      return await this.pool.exec('anotherJob', [hash, root, output, target, compareHashes, logAffected], {
        on: message => Logger.log(3, message)
      });
    } catch (error) {
      return error;
    }
  }
}