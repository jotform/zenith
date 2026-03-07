/* eslint-disable no-case-declarations */

export const run = async () => {
  try {
    const args = process.argv;
    switch (args[2]) {
      case 'graph':
        // Dynamic import to avoid ConfigHelper loading before zenith.json exists
        const { default: GraphRunner } = await import('./commands/graph/Runner.js');
        const gRunner = new GraphRunner(...args);
        await gRunner.run();
        break;
      case 'init':
        // Dynamic import to avoid ConfigHelper loading before zenith.json exists
        const { default: InitRunner } = await import('./commands/init/InitRunner.js');
        const initRunner = new InitRunner(...args);
        await initRunner.run();
        break;
      case 'clean':
        // Dynamic import to avoid ConfigHelper loading before zenith.json exists
        const { default: CleanRunner } = await import('./commands/clean/CleanRunner.js');
        const cleanRunner = new CleanRunner(...args);
        await cleanRunner.run();
        break;
      case 'stats':
        // Dynamic import to avoid ConfigHelper loading before zenith.json exists
        const { default: StatsRunner } = await import('./commands/stats/StatsRunner.js');
        const statsRunner = new StatsRunner(...args);
        await statsRunner.run();
        break;
      default:
        // Dynamic import to avoid ConfigHelper loading before zenith.json exists
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
