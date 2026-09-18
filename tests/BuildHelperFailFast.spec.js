import BuildHelper from '../build/classes/Builder/BuildHelper';
import { ZenithCommandError } from '../build/utils/errors';

const makeFailure = (project = '@scope/pkg') => new ZenithCommandError('Command failed: pnpm run build', {
  project,
  script: 'build',
  command: 'pnpm --filter @scope/pkg build',
  cwd: '/repo',
  phase: 'execute',
  exitCode: 1,
  stdout: 'TS6133: unused\n',
  stderr: ''
});

describe('BuildHelper failFast', () => {
  afterEach(() => {
    BuildHelper.exiting = false;
    jest.restoreAllMocks();
  });

  test('prints the real failure and exits without awaiting shutdown', () => {
    const helper = new BuildHelper('build', '1', false);
    let shutdownSettled = false;
    helper.shutdown = jest.fn(() => new Promise((resolve) => {
      setTimeout(() => {
        shutdownSettled = true;
        resolve();
      }, 5000);
    }));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });

    const started = Date.now();
    expect(() => helper.failFast(makeFailure())).toThrow('process.exit:1');
    expect(Date.now() - started).toBeLessThan(500);
    expect(shutdownSettled).toBe(false);
    expect(helper.shutdown).toHaveBeenCalledTimes(1);
    expect(BuildHelper.exiting).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy.mock.calls[0][0]).toContain('Zenith failed: @scope/pkg');
    expect(errorSpy.mock.calls[0][0]).toContain('TS6133: unused');
    expect(errorSpy.mock.calls[0][0]).not.toContain('Workerpool Worker terminated Unexpectedly');
  });

  test('second failFast still exits without starting another shutdown', () => {
    const helper = new BuildHelper('build', '1', false);
    BuildHelper.exiting = true;
    helper.shutdown = jest.fn(() => new Promise(() => undefined));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });

    expect(() => helper.failFast(makeFailure('@scope/other'))).toThrow('process.exit:1');
    expect(helper.shutdown).not.toHaveBeenCalled();
  });
});
