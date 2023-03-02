import workerpool from 'workerpool';
import { readFileSync } from 'fs';
import * as path from 'path';
import ConfigHelper from './ConfigHelper';

export default class WorkerHelper {
  started = new Set();

  constructor() {
    this.pool = workerpool.pool(__dirname + '/Worker.js', { maxWorkers: 6, workerType: 'thread' });
    const workspace = readFileSync(path.join(__dirname, '../workspace.json'), { encoding: 'utf-8' });
    this.workspaceJSON = JSON.parse(workspace || '').projects;
    this.buildConfigJSON = ConfigHelper.buildConfigJSON;
  }

  async execute(buildPath, command, hash, root, outputs) {
    try {
      return await this.pool.exec('execute', [buildPath, command, hash, root, outputs], {
        on: message => console.log(message)
      })
    } catch (error) {
      console.log(error);
    }
  }

  async anotherJob(hash, root, output) {
    try {
      return await this.pool.exec('anotherJob', [hash, root, output], {
        on: message => console.log(message)
      });
    } catch (error) {
      console.log(error);
    }
  }
}
