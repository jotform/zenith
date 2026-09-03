/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { writeFileSync } from 'fs';
import { Command } from 'commander';
import { configManagerInstance } from '../../config';
import Graph from './Graph';
import Server from './server';
import Logger from '../../utils/logger';

export default class GraphRunner {
  affected = false;

  base = 'master';

  debug = false;

  exclude = '';

  file = '';

  writeFile = false;

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
      .option('-f, --file <outputFile>', 'Write graph JSON (nodes/links) to this file instead of only serving the UI');
    program.parse(args);
    const options = program.opts();
    this.setIfExists('projects', (options.projects as string).split(',').map((p: string) => p.trim()), 'all');
    this.setIfExists('affected', options.affected);
    this.setIfExists('base', options.base);
    this.setIfExists('exclude', options.exclude);
    if (program.getOptionValueSource('file') === 'cli') {
      this.file = options.file as string;
      this.writeFile = true;
    }
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
    if (this.writeFile) {
      writeFileSync(this.file, JSON.stringify(data, null, 2), { encoding: 'utf-8' });
      Logger.log(2, `Graph written to ${this.file}`);
      return;
    }
    const server = new Server(data);
    server.createServer();
  }
}
