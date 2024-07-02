/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Command } from 'commander';
import { configManagerInstance } from '../../config';
import Graph from './Graph';
import Server from './server';

export default class GraphRunner {
  affected = false;

  base = 'master';

  debug = false;

  exclude = '';

  file = 'output.json';

  projects: string[] = ['all'];

  static workspace = new Map<string, Set<string>>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setIfExists(name: keyof this, value: any, defaultVal?: any) {
    if (value) {
      this[name] = value;
    }
    else if (defaultVal) {
      this[name] = defaultVal;
    }
  }

  constructor(...args: readonly string[]) {
    const program = new Command();
    program
      .option('--projects <projects>', 'Set comma-seperated projects to graph its dependencies. default: "all"', 'all')
      .option('-a, --affected', 'Highlight affected projects', false)
      .option('-b, --base <base>', 'Base of the current branch', 'main')
      .option('-d, --debug', 'Debug mode')
      .option('-e, --exclude <exclude>', 'Exclude certain projects from being processed')
      .option('-f, --file <outputFile>', 'Output file', 'output.json');
    program.parse(args);
    const options = program.opts();
    this.setIfExists('projects', (options.projects as string).split(',').map((p: string) => p.trim()), 'all');
    this.setIfExists('affected', options.affected);
    this.setIfExists('base', options.base);
    this.setIfExists('exclude', options.exclude);
    this.setIfExists('file', options.file);
    if (options.debug) {
      configManagerInstance.updateConfig({ ZENITH_DEBUG: true });
    }
  }

  async run(): Promise<void> {
    const grapher = new Graph();
    if (this.projects[0] === 'all') {
      await grapher.buildAll();
    } else {
      const projectAdditionPromisses = this.projects.map(p => grapher.addProject(p));
      await Promise.all(projectAdditionPromisses);
    }
    grapher.constructGraph();
    const data = {
      nodes: grapher.nodes,
      links: grapher.links
    };
    const server = new Server(data);
    server.createServer();
  }
}
