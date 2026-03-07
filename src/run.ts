/* eslint-disable no-case-declarations */

export const run = async () => {
  try {
    const args = process.argv;
    switch (args[2]) {
      case 'graph':
        // Dynamic import to avoid loading ConfigHelper when not needed
        const { default: GraphRunner } = await import('./commands/graph/Runner.js');
        const gRunner = new GraphRunner(...args);
        await gRunner.run();
        break;
      case 'init':
        // Dynamic import - init doesn't need ConfigHelper
        const { default: InitRunner } = await import('./commands/init/InitRunner.js');
        const initRunner = new InitRunner(...args);
        await initRunner.run();
        break;
      default:
        // Import only when running build/test commands
        const { default: Runner } = await import('./classes/Runner.js');
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
