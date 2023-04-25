import { Module } from 'module';
import Runner from './classes/Runner.js';

export const run = async () => {
  try {
    const args = process.argv;
    const RunnerHelper = new Runner(...args);
    await RunnerHelper.run();
  } catch (error) {
    console.log('ERR => R-I ::');
    if (error instanceof Error) throw error;
    throw Error(String(error));
  }
};

if (require.main instanceof Module) {
  void run();
}
