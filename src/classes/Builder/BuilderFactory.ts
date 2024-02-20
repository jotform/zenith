import BuildHelper from './BuildHelper';
import SingleBuilder from './SingleBuilder';

export default class BuilderFactory {
  static getBuilder(buildType: 'project' | 'single', {command, worker, coloredOutput}: {command: string, worker: string, coloredOutput: boolean}): BuildHelper {
    switch (buildType) {
        case 'project':
            return new BuildHelper(command, worker, coloredOutput);
        case 'single':
            return new SingleBuilder(command, worker, coloredOutput);
      default:
        throw new Error('Invalid cache type');
    }
  }
}