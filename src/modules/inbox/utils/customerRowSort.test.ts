import { describe, expect, it } from 'vitest';
import { sortCustomerRows } from './customerRowSort';
import { COLD_AFTER_MS, inboxCue, isColdRow, rowPrimary, showsRowChip } from './inboxRowAction';

const h = 3600_000;
const NOW = Date.parse('2026-10-14T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const ag = (side: 'us' | 'them', sinceMs: number) => ({ bucket: 'customer', aging: { ball: { side, sinceMs } } }) as never;
const row = (key: string, ids: string[], extra: Partial<{ kind: 'linked' | 'unlinked'; everReplied: boolean; latestMessageAt: string }> = {}) => ({
  key,
  conversationIds: ids,
  kind: 'linked' as 'linked' | 'unlinked',
  everReplied: true,
  latestMessageAt: ago(h),
  ...extra,
});

describe('sortCustomerRows (page-level, drives default selection)', () => {
  it('customer chasing NEWEST first, then waiting on them (longest first), unaged last', () => {
    const map = new Map([
      ['a', ag('them', 50 * h)],
      ['b1', ag('them', 1 * h)],
      ['b2', ag('us', 2 * h)],
      ['c', ag('us', 9 * h)],
    ]);
    const rows = [row('A', ['a']), row('B', ['b1', 'b2']), row('C', ['c']), row('D', ['none'])];
    expect(sortCustomerRows(rows, map, NOW).map((r) => r.key)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('cold unlinked rows (never replied, > 14 days) sort after everything', () => {
    const map = new Map([
      ['spam', ag('us', 60 * 24 * h)],
      ['fresh', ag('us', 3 * h)],
      ['old-linked', ag('us', 60 * 24 * h)],
    ]);
    const rows = [
      row('SPAM', ['spam'], { kind: 'unlinked', everReplied: false, latestMessageAt: ago(60 * 24 * h) }),
      row('OLD', ['old-linked'], { latestMessageAt: ago(60 * 24 * h) }),
      row('FRESH', ['fresh']),
    ];
    expect(sortCustomerRows(rows, map, NOW).map((r) => r.key)).toEqual(['FRESH', 'OLD', 'SPAM']);
  });
});

describe('isColdRow', () => {
  it('only unlinked, never-replied rows older than 14 days', () => {
    const old = ago(COLD_AFTER_MS + h);
    expect(isColdRow({ kind: 'unlinked', everReplied: false, latestMessageAt: old }, NOW)).toBe(true);
    expect(isColdRow({ kind: 'unlinked', everReplied: true, latestMessageAt: old }, NOW)).toBe(false);
    expect(isColdRow({ kind: 'linked', everReplied: false, latestMessageAt: old }, NOW)).toBe(false);
    expect(isColdRow({ kind: 'unlinked', everReplied: false, latestMessageAt: ago(13 * 24 * h) }, NOW)).toBe(false);
  });
});

describe('inboxCue', () => {
  it('does not count cold rows', () => {
    const follow = { action: { kind: 'follow', label: 'Follow up enquiry', reason: '', tone: 'red' }, timer: { text: 'Overdue · 2d', tone: 'over' } } as const;
    const cue = inboxCue([{ ...follow }, { ...follow, cold: true }] as never);
    expect(cue).toEqual({ needYou: 1, overdue: 1, dueSoon: 0 });
  });
});

describe('rowPrimary / showsRowChip', () => {
  const dep = { kind: 'deposit', label: 'Request deposit', reason: '', tone: 'neutral' } as const;
  it('deposit with an invoice opens its Collect payment pre-filled', () => {
    expect(rowPrimary({ action: dep, timer: null, order: { invoice_id: 'inv-1' } as never })?.target).toBe(
      '/dashboard/finance?invoice=inv-1&focus=collect&amount=deposit',
    );
    expect(
      rowPrimary({ action: { ...dep, kind: 'balance', label: 'Create balance payment' }, timer: null, order: { invoice_id: 'inv-2' } as never })?.target,
    ).toBe('/dashboard/finance?invoice=inv-2&focus=collect&amount=full');
    expect(rowPrimary({ action: dep, timer: null })?.target).toBe('/dashboard/finance');
  });
  it('chips only for non-reply steps', () => {
    expect(showsRowChip(dep)).toBe(true);
    expect(showsRowChip({ kind: 'follow', label: 'Follow up enquiry', reason: '', tone: 'red' })).toBe(false);
    expect(showsRowChip({ kind: 'none', label: '', reason: '', tone: 'neutral' })).toBe(false);
  });
});
