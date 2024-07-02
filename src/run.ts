/* eslint-disable no-case-declarations */
import Runner from './classes/Runner.js';
import GraphRunner from './commands/graph/Runner.js';

export const run = async () => {
  try {
    const args = process.argv;
    switch (args[2]) {
      case 'graph':
        const gRunner = new GraphRunner(...args);
        await gRunner.run();
        break;
        default:
        const RunnerHelper = new Runner(...args);
        await RunnerHelper.runWrapper();
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('ERR => R-I ::');
    if (error instanceof Error) throw error;
    throw Error(String(error));
  }
};
