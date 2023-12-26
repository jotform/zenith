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

  skipDependencies = false;

  debugLocation = 'debug/';

  worker = '6';

  skipPackageJson = false;

  constructor(...args: readonly string[]) {
    const program = new Command();
    program
      .option('-p, --project <project>', 'Project name')
      .option('-t, --target <target>', 'Target name')
      .option('-d, --debug', 'Debug mode')
      .option('-c, --compareWith <compareWith>', 'Compare with')
      .option('-ch, --noCompareHash', 'default: false. If false, will compare remote folders\' and local folders\' hash and execute target if hashes are not the same.')
      .option('-la, --logAffected', 'default: false. If true, will log outputs of ONLY missed caches\' executes.')
      .option('-sd, --skipDependencies', 'default: false. If true, will skip dependencies and execute only the target.')
      .option('-sp, --skipPackageJson', 'default: false. If true, will check package.json files before checking the cache and will skip the project if the target script is not in it.')
      .option('-nc, --noCache', 'default: false. If true, will skip the cache and execute the target.')
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
    if (options.skipDependencies) {
      this.skipDependencies = true;
    }
    if (options.skipPackageJson) {
      this.skipPackageJson = true;
    }
    if (options.noCache) {
      configManagerInstance.updateConfig({ 
        ZENITH_NO_CACHE: true,
        ZENITH_READ_ONLY: true
      });
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
      skipDependencies: this.skipDependencies,
      debugLocation: this.debugLocation,
      skipPackageJson: this.skipPackageJson,
      noCache: configManagerInstance.getConfigValue('ZENITH_NO_CACHE')
    });
    Logger.log(2, `Zenith ${this.command} started.`);
    if (this.project === 'all') {
      Builder.buildAll();
    } else {
      Builder.addProject(this.project);
    }
    Logger.log(2, `Zenith ${command} started.`);
    await Builder.build();
  }
}
