/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Command, Option } from 'commander';
import BuildHelper from './BuildHelper';
import Logger from '../utils/logger';
import { configManagerInstance } from '../config';

export default class Runner {
  project = '';

  command = '';

  compareWith = '';

  debug = false;

  compareHash = true;

  logAffected = false;

  debugLocation = 'debug/';

  worker = '6';

  constructor(...args: readonly string[]) {
    const program = new Command();
    program
      .option('-p, --project <project>', 'Project name')
      .option('-t, --target <target>', 'Target name')
      .option('-d, --debug', 'Debug mode')
      .option('-c, --compareWith <compareWith>', 'Compare with')
      .option('-ch, --noCompareHash', 'default: false. If false, will compare remote folders\' and local folders\' hash and execute target if hashes are not the same.')
      .option('-la, --logAffected', 'default: false. If true, will log outputs of ONLY missed caches\' executes.')
      .addOption(
        new Option(
          '-l, --logLevel <logLevel>',
          'Log Level [1-2-3]: 1=silent, 2=default (log info after completion and errors), 3=verbose (missing/hit cache info'
        ).choices(['1', '2', '3']).default('2')
      )
      .addOption(
        new Option(
          '-dl, --debugLocation <debugLocation>',
          'Debug Location: sets the prefix of the debug location. By default, it is "debug/", and it usage is as follows: \n {target}/{debugLocation}debug.{hash}.json'
        ).default('debug/')
      )
      .addOption(
        new Option(
          '-w, --worker <worker>',
          'Worker Number (default = 6): sets the maximum number of workers that run concurrently.'
        ).default('6')
      );
    program.parse(args);
    const options = program.opts();
    if (options.project) {
      this.project = options.project;
    }
    if (options.target) {
      this.command = options.target;
    }
    if (options.debug) {
      configManagerInstance.updateConfig({ ZENITH_DEBUG: true });
    }
    if (options.compareWith) {
      this.compareWith = options.compareWith;
    }
    if (options.noCompareHash) {
      this.compareHash = false;
    }
    if (options.logAffected) {
      this.logAffected = true;
    }
    this.debugLocation = options.debugLocation;
    this.worker = options.worker;

    Logger.setLogLevel(Number(options.logLevel));
  }

  async run(): Promise<void> {
    const Builder = new BuildHelper(this.command, this.worker);
    await Builder.init({
      debug: configManagerInstance.getConfigValue('ZENITH_DEBUG'),
      compareWith: this.compareWith,
      compareHash: this.compareHash,
      logAffected: this.logAffected,
      debugLocation: this.debugLocation
    });
    Logger.log(2, `Zenith ${this.command} started.`);
    if (this.project === 'all') {
      Builder.buildAll();
    } else {
      Builder.addProject(this.project);
    }
    Builder.build();
  }
}
