import { Command } from 'commander';
import BuildHelper from './BuildHelper';

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
    const flags = args.slice(2).reduce((acc, curr) => {
      const [key, value] = curr.split('=');
      acc[key] = value;
      return acc;
    }, {});
    if (flags['--project']) {
      this.project = flags['--project'];
    }
    if (flags['--target']) {
      this.command = flags['--target'];
    }
    if (flags['--debug']) {
      this.debug = true;
    }
    if (flags['--compareWith']) {
      this.compareWith = flags['--compareWith'];
    }
    if (options.logLevel) {
      this.logLevel = Number(options.logLevel);
    }

    this.logFunction = logLevel => (level, ...args) => {
      if (logLevel >= level) console.log(...args);
    }
    this.log = this.logFunction(this.logLevel)
  }

  async run() {
    if (this.command !== 'build') {
      return;
    }
    const Builder = new BuildHelper('build');
    await Builder.init(this.debug, this.compareWith, this.logLevel, this.logFunction);
    this.log(2, 'Zenith started. Building...')
    if (this.project === 'all') {
      Builder.buildAll();
    } else {
      Builder.addProject(this.project);
    }
    Builder.build();
  }
}