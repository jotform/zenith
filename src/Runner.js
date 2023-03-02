import { program } from 'commander';
import BuildHelper from './BuildHelper';

program
  .option('-p, --project <project>', 'Project name')
  .option('-t, --target <target>', 'Target name')
  .option('-d, --debug', 'Debug mode')
  .option('-c, --compareWith <compareWith>', 'Compare with')

class Runner {
  constructor(...args) {
    program
      .option('-p, --project <project>', 'Project name')
      .option('-t, --target <target>', 'Target name')
      .option('-d, --debug', 'Debug mode')
      .option('-c, --compareWith <compareWith>', 'Compare with');
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
  }

  async run() {
    if (this.command !== 'build') {
      return;
    }
    const Builder = new BuildHelper('build');
    await Builder.init(this.debug, this.compareWith);
    if (this.project === 'all') {
      Builder.buildAll();
    } else {
      Builder.addProject(this.project);
    }
    Builder.build();
  }
}

export default Runner;