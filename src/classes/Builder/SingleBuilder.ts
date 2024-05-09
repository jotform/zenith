import Logger from '../../utils/logger';
import BuildHelper from "./BuildHelper";
import { formatTimeDiff } from '../../utils/functions';

export default class SingleBuilder extends BuildHelper {

  async fetchOrRun(hash: string) {
    const recoverResponse = await this.anotherJob(hash, 'root', 'stdout', this.command, false, this.logAffected);
    if (recoverResponse === 'Cache not found') {
      Logger.log(2, 'Cache does not exist for command => ', this.command, hash);
      await this.runManual({cwd: './', command: this.command, hash});
    }
    this.totalCount++;
  }

  async runManual({cwd, command, hash}: {cwd: string, command: string, hash: string}) {
    const output = await this.executeManual({cwd, command, hash});
    if (output instanceof Error) {
      throw output;
    }
    Logger.log(2, output.output);
  }

  async build(): Promise<void> {
    const hash = this.hasher.getSingleHash({script: this.command, projects: this.projects});
    try {
      await this.fetchOrRun(hash);
    } catch (err) {
      Logger.log(2, err);
      process.exit(1);
    }
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const stats = this.pool.stats();
      if (!stats.activeTasks && !stats.pendingTasks) {
        void this.pool.terminate();
        Logger.log(2, this.outputColor, `Zenith completed command: ${this.command}. ${this.noCache ? '(Cache was not used)' : ''}`);
        Logger.log(2, this.outputColor, `Total of ${this.totalCount} project${this.totalCount === 1 ? ' is' : 's are'} finished.`);
        Logger.log(2, this.outputColor, `Total process took ${formatTimeDiff(process.hrtime(this.startTime))}.`);
        return;
      }
    }
  }
}