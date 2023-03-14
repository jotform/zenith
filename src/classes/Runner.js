import { Command } from 'commander';
import BuildHelper from './BuildHelper';
import Logger from '../utils/logger'

export default class Runner {
  constructor(...args) {
    const program = new Command();
    program
      .option('-p, --project <project>', 'Project name')
      .option('-t, --target <target>', 'Target name')
      .option('-d, --debug', 'Debug mode')
      .option('-c, --compareWith <compareWith>', 'Compare with')
      .option('-l, --logLevel <logLevel>', 'Log Level [1-2-3]: 1=silent, 2=default (log info after completion and errors), 3=verbose (missing/hit cache info', 2);
    program.parse(args);
    const options = program.opts();
    this.command = args.slice(-1);
    if (options.project) {
      this.project = options.project;
    }
    if (options.target) {
      this.command = options.target;
    }
    if (options.debug) {
      this.debug = true;
    }
    if (options.compareWith) {
      this.compareWith = options.compareWith;
    }
    Logger.setLogLevel(Number(options.logLevel));
  }

  async run() {
    if (this.command !== 'build') {
      Logger.log(1, 'Zenith currently only supports build command. Try again with adding "--target=build" argument.')
      return;
    }
    const Builder = new BuildHelper('build');
    await Builder.init(this.debug, this.compareWith);
    Logger.log(2, 'Zenith started. Building...')
    if (this.project === 'all') {
      Builder.buildAll();
    } else {
      Builder.addProject(this.project);
    }
    Builder.build();
  }
}