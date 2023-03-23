import { Command, Option } from 'commander';
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
      .option('-ch, --noCompareHash', 'default: false. If false, will compare remote folders\' and local folders\' hash and execute target if hashes are not the same.')
      .option('-la, --logAffected', 'default: false. If true, will log outputs of ONLY missed caches\' executes.')
      .addOption(
        new Option(
          '-l, --logLevel <logLevel>',
          'Log Level [1-2-3]: 1=silent, 2=default (log info after completion and errors), 3=verbose (missing/hit cache info'
        ).choices(['1', '2', '3']).default('2'));
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
    this.compareHash = true
    if (options.noCompareHash) {
      this.compareHash = false;
    }
    if (options.logAffected) {
      this.logAffected = true;
    }

    Logger.setLogLevel(Number(options.logLevel));
  }

  async run() {
    const Builder = new BuildHelper(this.command);
    await Builder.init({
      debug: this.debug, 
      compareWith: this.compareWith, 
      compareHash: this.compareHash, 
      logAffected: this.logAffected
    });
    Logger.log(2, `Zenith ${this.command} started.`)
    if (this.project === 'all') {
      Builder.buildAll();
    } else {
      Builder.addProject(this.project);
    }
    Builder.build();
  }
}