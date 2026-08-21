import { formatTimeDiff, isOutputTxt, deepCloneMap, formatMissingProjects, getMissingRequiredFiles } from '../build/utils/functions';
import { SAVE_AS_TXT_KEYWORD } from '../build/utils/constants';

describe('formatTimeDiff', () => {
  test('should format seconds correctly', () => {
    const time = [5, 500000000]; // 5.5 seconds
    const result = formatTimeDiff(time);
    expect(result).toBe('5.500s');
  });

  test('should format time over 60 seconds as minutes', () => {
    const time = [125, 0]; // 2 minutes 5 seconds
    const result = formatTimeDiff(time);
    expect(result).toBe('2m 5.000s');
  });

  test('should handle nanoseconds precision', () => {
    const time = [0, 123456789];
    const result = formatTimeDiff(time);
    expect(result).toBe('0.123s');
  });

  test('should handle zero time', () => {
    const time = [0, 0];
    const result = formatTimeDiff(time);
    expect(result).toBe('0.000s');
  });
});

describe('isOutputTxt', () => {
  test('should return true for stdout string', () => {
    expect(isOutputTxt(SAVE_AS_TXT_KEYWORD)).toBe(true);
  });

  test('should return false for other strings', () => {
    expect(isOutputTxt('build')).toBe(false);
    expect(isOutputTxt('dist')).toBe(false);
  });

  test('should return true when array contains stdout', () => {
    expect(isOutputTxt(['build', SAVE_AS_TXT_KEYWORD])).toBe(true);
  });

  test('should return false when array does not contain stdout', () => {
    expect(isOutputTxt(['build', 'dist'])).toBe(false);
  });
});

describe('deepCloneMap', () => {
  test('should create a deep clone of Map with Set values', () => {
    const original = new Map();
    original.set('key1', new Set(['a', 'b', 'c']));
    original.set('key2', new Set(['x', 'y']));

    const cloned = deepCloneMap(original);

    // Check that values are equal
    expect(cloned.get('key1')).toEqual(new Set(['a', 'b', 'c']));
    expect(cloned.get('key2')).toEqual(new Set(['x', 'y']));

    // Verify it's a different reference
    expect(cloned).not.toBe(original);
    expect(cloned.get('key1')).not.toBe(original.get('key1'));
  });

  test('should handle empty map', () => {
    const original = new Map();
    const cloned = deepCloneMap(original);
    expect(cloned.size).toBe(0);
  });
});

describe('formatMissingProjects', () => {
  test('should format projects with time', () => {
    const projects = [
      { buildProject: 'app1', time: [5, 0] }
    ];
    const result = formatMissingProjects(projects, 'Project');
    expect(result).toEqual([
      { 'Project': 'app1', 'Time': '5.000s' }
    ]);
  });

  test('should format projects with execTime and cacheTime', () => {
    const projects = [
      { buildProject: 'app2', execTime: [3, 0], cacheTime: [2, 0] }
    ];
    const result = formatMissingProjects(projects, 'Project');
    expect(result[0]['Project']).toBe('app2');
    expect(result[0]['Total Time']).toBe('5.000s');
  });

  test('should handle projects without time info', () => {
    const projects = [
      { buildProject: 'app3' }
    ];
    const result = formatMissingProjects(projects, 'Project');
    expect(result).toEqual([
      { 'Project': 'app3' }
    ]);
  });
});

describe('getMissingRequiredFiles', () => {
  test('should return empty array when requiredFiles is undefined', () => {
    const result = getMissingRequiredFiles('/some/path', undefined);
    expect(result).toEqual([]);
  });

  test('should return empty array when requiredFiles is empty', () => {
    const result = getMissingRequiredFiles('/some/path', []);
    expect(result).toEqual([]);
  });
});
