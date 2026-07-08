import { configManagerInstance, STATS_MODES } from '../src/config';

describe('stats mode config', () => {
  it('exposes silent/default/full modes', () => {
    expect(STATS_MODES.SILENT).toBe('silent');
    expect(STATS_MODES.DEFAULT).toBe('default');
    expect(STATS_MODES.FULL).toBe('full');
  });

  it('defaults ZENITH_STATS_MODE to "default"', () => {
    expect(configManagerInstance.getConfigValue('ZENITH_STATS_MODE')).toBe('default');
  });
});
