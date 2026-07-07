import Runner from '../src/classes/Runner';
import { configManagerInstance } from '../src/config';

describe('Runner --stats flag', () => {
  beforeEach(() => {
    process.env.CACHE_TYPE = 'local';
  });

  it('writes the given stats mode into config', () => {
    // eslint-disable-next-line no-new
    new Runner('node', 'zenith', '-t', 'build', '--stats', 'full');
    expect(configManagerInstance.getConfigValue('ZENITH_STATS_MODE')).toBe('full');
  });

  it('defaults to "default" when --stats is omitted', () => {
    // eslint-disable-next-line no-new
    new Runner('node', 'zenith', '-t', 'build');
    expect(configManagerInstance.getConfigValue('ZENITH_STATS_MODE')).toBe('default');
  });
});
