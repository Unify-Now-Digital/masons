/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { localDayKey, readDone, writeDone } from './sessionDone';

describe('session done', () => {
  it('keeps completions until local midnight', () => {
    localStorage.clear();
    const today = new Date(2026, 9, 15, 23, 30);
    writeDone('org-1', today, { a: 'Sent' });
    expect(readDone('org-1', today)).toEqual({ a: 'Sent' });
    expect(readDone('org-1', new Date(2026, 9, 16, 0, 1))).toEqual({});
    expect(localDayKey(today)).toBe('2026-10-15');
    localStorage.clear();
  });
});
