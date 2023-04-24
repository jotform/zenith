import Runner from './classes/Runner.js';

const run = async () => {
  try {
    const args = process.argv;
    const RunnerHelper = new Runner(...args);
    await RunnerHelper.run();
  } catch (error) {
    console.log('ERR => R-I ::');
    if (error instanceof Error) throw error;
    throw String(error);
  }
};

void run();
