import { buildTimeTable, buildSizeTable } from '../src/stats/statsTables';
import { buildStatsSummary, statsRenderPlan } from '../src/stats/statsSummary';

const HIT_WITH_SIZE = {
  status: 'HIT',
  hashMs: 120,
  metrics: {
    downloadMs: 9800, downloadBytes: 38100000, extractMs: 2500,
    outputBytes: 140000000, fileCount: 1200, source: 'remote',
  },
};

const HIT_NO_SIZE = {
  status: 'HIT',
  hashMs: 50,
  metrics: { downloadMs: 600, downloadBytes: 900000, extractMs: 200, source: 'local' },
};

const MISS = {
  status: 'MISS',
  execTime: [42, 100000000], // 42.1s
  hashMs: 310,
  metrics: {
    archiveMs: 2100, uploadMs: 1100, uploadBytes: 6200000,
    outputBytes: 19300000, fileCount: 312,
  },
};

const SKIP = { status: 'SKIP' };

const makeStats = () => new Map([
  ['@jf/lib1', HIT_NO_SIZE],
  ['@jf/app1', MISS],
  ['@jf/util', SKIP],
  ['@jf/lib2', HIT_WITH_SIZE],
]);

describe('buildTimeTable', () => {
  it('sorts by total row time descending, omits SKIP rows, and fills gaps with dashes', () => {
    const rows = buildTimeTable(makeStats());
    expect(rows.map(r => r.Project)).toEqual(['@jf/app1', '@jf/lib2', '@jf/lib1']);
    const miss = rows[0];
    expect(miss.Source).toBe('built');
    expect(miss.Exec).toBe('42.10s');
    expect(miss.Down).toBe('-');
    expect(miss.Total).toBe('45.61s'); // exec 42100 + hash 310 + archive 2100 + upload 1100
    expect(miss['Out Size']).toBe('18.4 MB');
    expect(miss.Files).toBe('312');
    expect(miss['Cache Size']).toBe('5.9 MB');
  });

  it('carries timing (with total) and size columns', () => {
    const row = buildTimeTable(makeStats())[0];
    expect(Object.keys(row)).toEqual(['Project', 'Source', 'Exec', 'Hash', 'Arch', 'Up', 'Down', 'Extr', 'Total', 'Out Size', 'Files', 'Cache Size']);
  });

  it('shows the backend that served each hit, and "built" for non-hits', () => {
    const rows = buildTimeTable(makeStats());
    expect(rows.find(r => r.Project === '@jf/app1').Source).toBe('built'); // MISS
    expect(rows.find(r => r.Project === '@jf/lib2').Source).toBe('remote');
    expect(rows.find(r => r.Project === '@jf/lib1').Source).toBe('local');
  });

  it('returns no rows when every project is SKIP', () => {
    const rows = buildTimeTable(new Map([['@jf/a', SKIP], ['@jf/b', SKIP]]));
    expect(rows).toEqual([]);
  });

  it('with builtOnly, excludes HIT rows but keeps MISS/STALE/BUILT', () => {
    const rows = buildTimeTable(makeStats(), { builtOnly: true });
    expect(rows.map(r => r.Project)).toEqual(['@jf/app1']); // both HITs dropped, MISS kept
  });

  it('without builtOnly, includes HIT rows', () => {
    const rows = buildTimeTable(makeStats(), { builtOnly: false });
    expect(rows.map(r => r.Project)).toEqual(['@jf/app1', '@jf/lib2', '@jf/lib1']);
  });

  it('does not cap the number of rows', () => {
    const stats = new Map();
    for (let i = 0; i < 40; i++) {
      stats.set(`@jf/p${i}`, { status: 'HIT', hashMs: i, metrics: { downloadMs: i } });
    }
    expect(buildTimeTable(stats)).toHaveLength(40);
  });

  it('marks slow recoveries with !', () => {
    const rows = buildTimeTable(makeStats());
    const slowHit = rows.find(r => r.Project === '@jf/lib2');
    expect(slowHit.Extr).toBe('2.50s !');
    const fastHit = rows.find(r => r.Project === '@jf/lib1');
    expect(fastHit.Extr).toBe('0.20s');
  });
});

describe('buildSizeTable', () => {
  it('lists artifacts biggest first with size columns and total time', () => {
    const rows = buildSizeTable(makeStats());
    expect(rows.map(r => r.Project)).toEqual(['@jf/lib2', '@jf/app1']);
    expect(Object.keys(rows[0])).toEqual(['Project', 'Out Size', 'Files', 'Cache Size', 'Total']);
    expect(rows[0]['Out Size']).toBe('133.5 MB');
    expect(rows[0].Files).toBe('1.2k');
    expect(rows[0]['Cache Size']).toBe('36.3 MB');
    expect(rows[0].Total).toBe('12.42s'); // hash 120 + download 9800 + extract 2500
    expect(rows[1]['Out Size']).toBe('18.4 MB');
    expect(rows[1]['Cache Size']).toBe('5.9 MB');
    expect(rows[1].Total).toBe('45.61s'); // exec 42100 + hash 310 + archive 2100 + upload 1100
  });

  it('omits SKIP rows and hits with no known output size', () => {
    const rows = buildSizeTable(makeStats());
    // @jf/lib1 (HIT, no known output size) and @jf/util (SKIP) are excluded
    expect(rows.map(r => r.Project)).not.toContain('@jf/lib1');
    expect(rows.map(r => r.Project)).not.toContain('@jf/util');
  });

  it('with builtOnly, excludes HIT artifacts', () => {
    const rows = buildSizeTable(makeStats(), { builtOnly: true });
    expect(rows.map(r => r.Project)).toEqual(['@jf/app1']); // @jf/lib2 is a HIT → dropped
  });

  it('without builtOnly, includes HIT artifacts biggest first', () => {
    const rows = buildSizeTable(makeStats(), { builtOnly: false });
    expect(rows.map(r => r.Project)).toEqual(['@jf/lib2', '@jf/app1']);
  });

  it('does not cap the number of artifacts', () => {
    const stats = new Map();
    for (let i = 1; i <= 25; i++) {
      stats.set(`@jf/p${i}`, { status: 'MISS', metrics: { outputBytes: i } });
    }
    expect(buildSizeTable(stats)).toHaveLength(25);
  });
});

describe('buildStatsSummary', () => {
  it('renders the simple summary with parallelism on the total line', () => {
    // busy = HIT_NO_META 850 + MISS 45610 + SKIP 0 + HIT_WITH_META 12420 = 58880ms; /40000 = 1.47 → 1.5
    const lines = buildStatsSummary(makeStats(), { wallMs: 40000 });
    expect(lines).toEqual([
      'Total of 4 projects are finished.',
      '2 projects used from cache,',
      '1 projects used without cache.',
      '',
      'Total process took 40.000s. (parallelism 1.5x)',
    ]);
  });

  it('uses "is" for a single project and 0.0x parallelism when wall is 0', () => {
    const lines = buildStatsSummary(new Map([['@jf/a', { status: 'MISS', execTime: [1, 0] }]]));
    expect(lines[0]).toBe('Total of 1 project is finished.');
    expect(lines[4]).toBe('Total process took 0.000s. (parallelism 0.0x)');
  });

  it('counts STALE and --noCache BUILT as without-cache, not from-cache', () => {
    const stats = new Map([
      ['@jf/hit', { status: 'HIT', metrics: { downloadMs: 100, extractMs: 50 } }],
      ['@jf/stale', { status: 'STALE', execTime: [1, 0], metrics: { archiveMs: 10 } }],
      ['@jf/nocache', { status: 'BUILT', execTime: [2, 0] }],
    ]);
    const lines = buildStatsSummary(stats, { wallMs: 5000 });
    expect(lines[0]).toBe('Total of 3 projects are finished.');
    expect(lines[1]).toBe('1 projects used from cache,');
    expect(lines[2]).toBe('2 projects used without cache.');
  });

  it('SKIP projects count toward finished but neither cache nor without-cache', () => {
    const stats = new Map([['@jf/a', { status: 'SKIP' }], ['@jf/b', { status: 'HIT', metrics: {} }]]);
    const lines = buildStatsSummary(stats, { wallMs: 1000 });
    expect(lines[0]).toBe('Total of 2 projects are finished.');
    expect(lines[1]).toBe('1 projects used from cache,');
    expect(lines[2]).toBe('0 projects used without cache.');
  });
});

describe('statsRenderPlan', () => {
  it('silent → summary only, no tables', () => {
    expect(statsRenderPlan('silent')).toEqual({ showTables: false, builtOnly: false });
  });
  it('default → tables with built-only rows', () => {
    expect(statsRenderPlan('default')).toEqual({ showTables: true, builtOnly: true });
  });
  it('full → tables with all rows', () => {
    expect(statsRenderPlan('full')).toEqual({ showTables: true, builtOnly: false });
  });
});
