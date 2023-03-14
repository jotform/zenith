import workerpool from 'workerpool';
import ConfigHelper from './ConfigHelper';
import Logger from '../utils/logger'

export default class WorkerHelper {
  started = new Set();

  constructor() {
    this.pool = workerpool.pool(__dirname + '/worker.js', { maxWorkers: 6, workerType: 'thread' });
    this.buildConfigJSON = ConfigHelper.buildConfigJSON;
  }

  async execute(buildPath, command, hash, root, outputs) {
    try {
      return await this.pool.exec('execute', [buildPath, command, hash, root, outputs], {
        on: message => Logger.log(3, message)
      })
    } catch (error) {
      console.log('execute msg in')
      Logger.log(2, error);
      throw error;
    }
  }

  async anotherJob(hash, root, output) {
    try {
      return await this.pool.exec('anotherJob', [hash, root, output], {
        on: message => Logger.log(3, message)
      });
    } catch (error) {
      console.log('another job msg in')
      Logger.log(2, error);
      throw error;
    }
  }
}
