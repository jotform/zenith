import BuildHelper from '../build/classes/Builder/BuildHelper';
import { configManagerInstance } from '../build/config';
import Logger from '../build/utils/logger';
import * as statsTables from '../build/stats/statsTables';

describe('BuildHelper stats rendering by mode', () => {
  let helper;
  let logSpy;
  let timeSpy;
  let sizeSpy;

  beforeEach(() => {
    process.env.CACHE_TYPE = 'local';
    helper = new BuildHelper('build', '1', false);
    helper.recordProjectStats('@jf/app1', { status: 'MISS', execTime: [1, 0], metrics: { outputBytes: 1000, fileCount: 3 } });
    helper.recordProjectStats('@jf/lib1', { status: 'HIT', metrics: { downloadMs: 100, extractMs: 50, outputBytes: 2000, fileCount: 5 } });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    // Spy the table builders (call through) to assert the mode→{showTables,builtOnly}
    // wiring end-to-end without depending on voici's table-body output.
    timeSpy = jest.spyOn(statsTables, 'buildTimeTable');
    sizeSpy = jest.spyOn(statsTables, 'buildSizeTable');
  });

  afterEach(async () => {
    logSpy.mockRestore();
    timeSpy.mockRestore();
    sizeSpy.mockRestore();
    Logger.setLogLevel(2); // restore default in case a test changed it
    await helper.pool.terminate(true).catch(() => {});
  });

  const output = () => logSpy.mock.calls.map(c => c.join(' ')).join('\n');

  it('silent → summary only, table builders not called', async () => {
    configManagerInstance.updateConfig({ ZENITH_STATS_MODE: 'silent' });
    await helper.build();
    expect(output()).toContain('finished');            // summary present
    expect(output()).not.toContain('Build — by time');
    expect(output()).not.toContain('Largest Artifacts');
    expect(timeSpy).not.toHaveBeenCalled();            // tables hidden
    expect(sizeSpy).not.toHaveBeenCalled();
  });

  it('default → tables built-only (builtOnly: true) + summary', async () => {
    configManagerInstance.updateConfig({ ZENITH_STATS_MODE: 'default' });
    await helper.build();
    expect(output()).toContain('Build — by time');
    expect(output()).toContain('Largest Artifacts');
    expect(output()).toContain('finished');
    expect(timeSpy).toHaveBeenCalledWith(expect.any(Map), { builtOnly: true });
    expect(sizeSpy).toHaveBeenCalledWith(expect.any(Map), { builtOnly: true });
  });

  it('full → tables all rows (builtOnly: false) + summary', async () => {
    configManagerInstance.updateConfig({ ZENITH_STATS_MODE: 'full' });
    await helper.build();
    expect(output()).toContain('Build — by time');
    expect(output()).toContain('Largest Artifacts');
    expect(output()).toContain('finished');
    expect(timeSpy).toHaveBeenCalledWith(expect.any(Map), { builtOnly: false });
    expect(sizeSpy).toHaveBeenCalledWith(expect.any(Map), { builtOnly: false });
  });

  it('stats block is independent of logLevel (still prints at logLevel 1)', async () => {
    Logger.setLogLevel(1); // silence operational logs
    configManagerInstance.updateConfig({ ZENITH_STATS_MODE: 'default' });
    await helper.build();
    // summary + tables still render even though operational logs are silenced
    expect(output()).toContain('finished');
    expect(output()).toContain('Build — by time');
    expect(output()).toContain('Largest Artifacts');
    expect(timeSpy).toHaveBeenCalled();
    // the operational completion line IS gated by logLevel, so it is suppressed
    expect(output()).not.toContain('Zenith completed command');
  });
});
