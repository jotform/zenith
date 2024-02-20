/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Command, Option } from 'commander';
import BuilderFactory from './Builder/BuilderFactory';
import ConfigHelperInstance from './ConfigHelper';
import Logger from '../utils/logger';
import { deepCloneMap } from '../utils/functions';
import { configManagerInstance } from '../config';
import { PipeConfigArray } from '../types/ConfigTypes';

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

  singleCache = false;

  pipe: PipeConfigArray = [];

  pipeIndex = 0;

  coloredOutput = true;

  static workspace = new Map<string, Set<string>>();

  constructor(...args: readonly string[]) {
    const program = new Command();
    program
      .option('-p, --project <project>', 'Project name. If not specified, will run all projects.', 'all')
      .option('-t, --target <target>', 'Target name')
      .option('-d, --debug', 'Debug mode')
      .option('-c, --compareWith <compareWith>', 'Compare with')
      .option('-ch, --noCompareHash', 'default: false. If false, will compare remote folders\' and local folders\' hash and execute target if hashes are not the same.')
      .option('-la, --logAffected', 'default: false. If true, will log outputs of ONLY missed caches\' executes.')
      .option('-sd, --skipDependencies', 'default: false. If true, will skip dependencies and execute only the target.')
      .option('-sp, --skipPackageJson', 'default: false. If true, will check package.json files before checking the cache and will skip the project if the target script is not in it.')
      .option('-nc, --noCache', 'default: false. If true, will skip the cache and execute the target.')
      .option('-np, --noPipe', 'default: false. If true, will skip the pipe and execute the target.')
      .option('-co, --coloredOutput <color>', 'default: true. If false, will disable colors in the console.', 'true')
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
    this.pipe = options.noPipe ? [] : ConfigHelperInstance.pipe;
    this.coloredOutput = options.coloredOutput === 'true';

    Logger.setLogLevel(Number(options.logLevel));
  }

  async runWrapper(): Promise<void> {
    if (this.pipe.length === 0) {
      await this.run(this.command);
      return;
    }
    await this.runPipe();
  }

  async runPipe(): Promise<void> {
    const pipeTarget = this.pipe[this.pipeIndex];
    if (Array.isArray(pipeTarget)) {
      await Promise.all(pipeTarget.map(async (target) => {
        await this.run(target.script, target.config);
      }));
    } else {
      await this.run(pipeTarget.script, pipeTarget.config);
    }
    this.pipeIndex += 1;
    if (this.pipeIndex < this.pipe.length) {
      await this.runPipe();
    }
  }

  async run(command: string, config: { worker?: string} = {}): Promise<void> {
    const buildConfig = {
      project: this.project,
      workspace: Runner.workspace,
      debug: configManagerInstance.getConfigValue('ZENITH_DEBUG'),
      compareWith: this.compareWith,
      compareHash: this.compareHash,
      logAffected: this.logAffected,
      skipDependencies: this.skipDependencies,
      debugLocation: this.debugLocation,
      skipPackageJson: this.skipPackageJson,
      noCache: configManagerInstance.getConfigValue('ZENITH_NO_CACHE'),
      ...config
    };
    const buildType = this.singleCache ? 'single' : 'project';
    const Builder = BuilderFactory.getBuilder(buildType, {command, worker: config.worker || this.worker, coloredOutput: this.coloredOutput});
    await Builder.init(buildConfig);
    if (Runner.workspace.size === 0) {
      Runner.workspace = deepCloneMap(Builder.getProjects());
    }
    Logger.log(2, `Zenith ${command} started.`);
    await Builder.build();
  }
}
