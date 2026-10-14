import { describe, expect, it } from 'vitest';
import { londonDayKey, londonMidnight, londonMonthRange, londonMonthStart, londonWeekStart } from './londonTime';

describe('londonTime', () => {
  it('uses the London calendar day, not UTC or the device zone', () => {
    // 23:30 UTC on 31 Mar 2026 is 00:30 BST on 1 Apr in London.
    expect(londonDayKey(new Date('2026-03-31T23:30:00Z'))).toBe('2026-04-01');
    // 23:30 UTC on 31 Jan is still 31 Jan in London (GMT).
    expect(londonDayKey(new Date('2026-01-31T23:30:00Z'))).toBe('2026-01-31');
  });
  it('month start is London midnight in both GMT and BST', () => {
    expect(londonMonthStart(new Date('2026-10-14T12:00:00Z')).toISOString()).toBe('2026-09-30T23:00:00.000Z');
    expect(londonMonthStart(new Date('2026-12-14T12:00:00Z')).toISOString()).toBe('2026-12-01T00:00:00.000Z');
    // A payment at 00:30 BST on 1 Oct belongs to October.
    expect(new Date('2026-09-30T23:30:00Z') >= londonMonthStart(new Date('2026-10-02T12:00:00Z'))).toBe(true);
  });
  it('handles the DST switch days', () => {
    expect(londonMidnight(2026, 3, 29).toISOString()).toBe('2026-03-29T00:00:00.000Z');
    expect(londonMidnight(2026, 3, 30).toISOString()).toBe('2026-03-29T23:00:00.000Z');
    expect(londonMidnight(2026, 10, 25).toISOString()).toBe('2026-10-24T23:00:00.000Z');
    expect(londonMidnight(2026, 10, 26).toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });
  it('week starts Monday 00:00 London', () => {
    expect(londonWeekStart(new Date('2026-10-14T12:00:00Z')).toISOString()).toBe('2026-10-11T23:00:00.000Z');
    // Sunday 23:30 UTC in winter is still Sunday in London.
    expect(londonWeekStart(new Date('2026-11-15T23:30:00Z')).toISOString()).toBe('2026-11-09T00:00:00.000Z');
  });
  it('month range for the ledger_totals RPC', () => {
    expect(londonMonthRange(new Date('2026-02-10T12:00:00Z'))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});
