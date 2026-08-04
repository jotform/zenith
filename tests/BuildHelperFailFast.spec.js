import BuildHelper from '../build/classes/Builder/BuildHelper';

describe('BuildHelper failFast', () => {
  afterEach(async () => {
    BuildHelper.exiting = false;
    jest.restoreAllMocks();
  });

  test('does not await pool.terminate (avoids hang on execSync workers)', () => {
    const helper = new BuildHelper('build', '1', false);
    let terminateSettled = false;
    helper.pool.terminate = jest.fn(() => new Promise((resolve) => {
      setTimeout(() => {
        terminateSettled = true;
        resolve();
      }, 5000);
    }));

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });

    const started = Date.now();
    expect(() => helper.failFast('@scope/pkg', new Error('build failed'))).toThrow('process.exit:1');
    expect(Date.now() - started).toBeLessThan(500);
    expect(terminateSettled).toBe(false);
    expect(helper.pool.terminate).toHaveBeenCalledWith(true);
    expect(BuildHelper.exiting).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(1);

    // Prevent the slow terminate promise from keeping Jest open.
    helper.pool.terminate = () => Promise.resolve();
  });

  test('second failFast still exits without awaiting terminate', () => {
    const helper = new BuildHelper('build', '1', false);
    BuildHelper.exiting = true;
    helper.pool.terminate = jest.fn(() => new Promise(() => undefined));
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });

    expect(() => helper.failFast('@scope/other', new Error('Worker terminated'))).toThrow('process.exit:1');
    expect(helper.pool.terminate).not.toHaveBeenCalled();
  });
});
