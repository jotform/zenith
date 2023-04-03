import workerpool from 'workerpool';
import ConfigHelper from './ConfigHelper';
import Logger from '../utils/logger'

export default class WorkerHelper {
  started = new Set();

  constructor(command, worker) {
    const workerConfig = {
      workerType: 'thread',
      // workerpool sets workers to total cpu - 1 if maxWorkers is undefined.
      ...(worker === 'max' ? {} : {maxWorkers: Number(worker)})
    }
    this.pool = workerpool.pool(__dirname + '/worker.js', workerConfig);
    this.buildConfigJSON = ConfigHelper.buildConfigJSON;
  }

  async execute(buildPath, command, hash, root, outputs, projectName) {
    try {
      return await this.pool.exec('execute', [buildPath, command, hash, root, outputs, projectName], {
        on: message => Logger.log(3, message)
      })
    } catch (error) {
      Logger.log(2, error);
      throw error;
    }
  }

  async anotherJob(hash, root, output, target, compareHashes, logAffected) {
    try {
      return await this.pool.exec('anotherJob', [hash, root, output, target, compareHashes, logAffected], {
        on: message => Logger.log(3, message)
      });
    } catch (error) {
      Logger.log(2, error);
      throw error;
    }
  }
}
