import Runner from './classes/Runner.js';

export const run = async () => {
  try {
    const args = process.argv;
    const RunnerHelper = new Runner(...args);
    await RunnerHelper.runWrapper();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('ERR => R-I ::');
    if (error instanceof Error) throw error;
    throw Error(String(error));
  }
};
