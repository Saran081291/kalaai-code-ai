import { describe, expect, it } from 'vitest';

import { activeStepIndex, findFile, getLineWindow, sortIssues } from '@/components/review/reviewUtils';

import { makeFiles, makeReview } from './fixtures';

describe('reviewUtils', () => {
  it('maps statuses to stepper indexes', () => {
    expect(activeStepIndex('pending')).toBe(0);
    expect(activeStepIndex('fetching')).toBe(0);
    expect(activeStepIndex('reviewing')).toBe(1);
    expect(activeStepIndex('roasting')).toBe(2);
    expect(activeStepIndex('completed')).toBe(3);
  });

  it('finds files by exact path, suffix or basename', () => {
    const files = makeFiles();
    expect(findFile(files, 'src/app.py')?.id).toBe(101);
    expect(findFile(files, 'app.py')?.id).toBe(101);
    expect(findFile(files, './src/utils.py')?.id).toBe(102);
    expect(findFile(files, 'lib/utils.py')?.id).toBe(102);
    expect(findFile(files, 'missing.py')).toBeUndefined();
  });

  it('caps rendered lines and centres the window on the target', () => {
    expect(getLineWindow(100, 50)).toEqual({ start: 0, end: 100, total: 100, truncated: false });
    expect(getLineWindow(5000, null)).toEqual({ start: 0, end: 2000, total: 5000, truncated: true });
    expect(getLineWindow(5000, 3000)).toEqual({ start: 1999, end: 3999, total: 5000, truncated: true });
    expect(getLineWindow(5000, 4990)).toEqual({ start: 3000, end: 5000, total: 5000, truncated: true });
  });

  it('sorts issues most severe first', () => {
    const issues = makeReview().issues;
    expect(sortIssues([...issues].reverse()).map((issue) => issue.severity)).toEqual(['major', 'nit']);
  });
});
