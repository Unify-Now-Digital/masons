import { describe, expect, it } from 'vitest';
import { inboxCue, inboxRowAction, type InboxOrderLike } from './inboxRowAction';
import type { AgingInfo } from './inboxBuckets';

const H = 3_600_000;
const NOW = new Date('2026-10-14T10:00:00Z');
const aging = (side: 'us' | 'them', sinceMs: number, level: AgingInfo['level']) => ({
  bucket: 'enquiry' as const,
  aging: { ball: { side, sinceMs }, level, isStuck: level === 'red', shortLabel: '' },
});
const order = (o: Partial<InboxOrderLike>): InboxOrderLike => ({
  person_id: 'p', deposit_date: '2026-10-01', second_payment_date: null, stone_status: 'Ordered',
  permit_status: 'approved', proof_status: 'Approved', installation_date: null, job: null, ...o,
});

describe('inboxRowAction', () => {
  it('enquiry on our turn → Follow up, overdue timer in words', () => {
    const r = inboxRowAction(aging('us', 52 * H, 'red'), [], NOW);
    expect(r.action.kind).toBe('follow');
    expect(r.timer).toEqual({ text: 'Overdue · 2d', tone: 'over' });
  });
  it('their turn → Waiting chip', () => {
    const r = inboxRowAction(aging('them', 2 * H, 'fresh'), [], NOW);
    expect(r.action).toMatchObject({ kind: 'waiting', label: 'Waiting · customer' });
    expect(r.timer?.text).toBe('Waiting · 2h');
  });
  it('an order that needs us wins (earliest stage across orders)', () => {
    const r = inboxRowAction(aging('them', H, 'fresh'), [
      order({ proof_status: 'Received' }),
      order({ permit_status: 'customer_completed' }),
    ], NOW);
    expect(r.action.kind).toBe('permit');
  });
  it('order waiting on cemetery but customer wrote → Follow up', () => {
    const r = inboxRowAction(aging('us', H, 'fresh'), [order({ permit_status: 'pending' })], NOW);
    expect(r.action.kind).toBe('follow');
  });
  it('order waiting and their turn → shows who we wait on', () => {
    const r = inboxRowAction(aging('them', H, 'fresh'), [order({ permit_status: 'pending' })], NOW);
    expect(r.action.waitingOn).toBe('cemetery');
  });
  it('no signal → none', () => {
    expect(inboxRowAction(null, [], NOW).action.kind).toBe('none');
  });
});

describe('inboxCue', () => {
  it('counts rows that need us, split overdue / due soon', () => {
    const rows = [
      inboxRowAction(aging('us', 52 * H, 'red'), [], NOW),
      inboxRowAction(aging('us', 3 * H, 'amber'), [], NOW),
      inboxRowAction(aging('us', 0.5 * H, 'fresh'), [], NOW),
      inboxRowAction(aging('them', H, 'fresh'), [], NOW),
    ];
    expect(inboxCue(rows)).toEqual({ needYou: 3, overdue: 1, dueSoon: 1 });
  });
});
