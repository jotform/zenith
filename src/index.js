import Runner from './Runner';

const run = async () => {
  try {
    const args = process.argv;
    const RunnerHelper = new Runner(...args);
    await RunnerHelper.run();
  } catch (error) {
    console.error(error);
  }
};

run();
