import BuildHelper from '../build/classes/Builder/BuildHelper';

describe('BuildHelper.recordProjectStats', () => {
  let helper;

  beforeEach(() => {
    process.env.CACHE_TYPE = 'local';
    helper = new BuildHelper('build', '1', false);
  });

  afterEach(async () => {
    await helper.pool.terminate(true);
  });

  it('creates entries and merges hash time and metrics additively', () => {
    helper.recordProjectStats('@jf/app1', { hashMs: 100 });
    helper.recordProjectStats('@jf/app1', {
      status: 'MISS',
      execTime: [1, 0],
      metrics: { uploadMs: 5, uploadBytes: 10 },
    });
    helper.recordProjectStats('@jf/app1', { metrics: { uploadMs: 2 } });
    helper.recordProjectStats('@jf/app1', { hashMs: 50 });
    const stats = helper.projectStats.get('@jf/app1');
    expect(stats.status).toBe('MISS');
    expect(stats.hashMs).toBe(150);
    expect(stats.execTime).toEqual([1, 0]);
    expect(stats.metrics).toEqual({ uploadMs: 7, uploadBytes: 10 });
  });

  it('does not let HIT overwrite MISS/STALE, but lets them overwrite SKIP defaults', () => {
    helper.recordProjectStats('@jf/a', { hashMs: 1 }); // entry defaults to SKIP
    expect(helper.projectStats.get('@jf/a').status).toBe('SKIP');
    helper.recordProjectStats('@jf/a', { status: 'HIT' });
    expect(helper.projectStats.get('@jf/a').status).toBe('HIT');
    helper.recordProjectStats('@jf/a', { status: 'STALE' });
    expect(helper.projectStats.get('@jf/a').status).toBe('STALE');
    helper.recordProjectStats('@jf/a', { status: 'HIT' });
    expect(helper.projectStats.get('@jf/a').status).toBe('STALE');
  });
});
