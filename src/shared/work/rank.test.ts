import { describe, expect, it } from 'vitest';
import { rank } from './rank';
import type { Urgency, WorkItem } from './types';

const NOW = new Date('2026-10-15T12:00:00Z');
const item = (id: string, urgency: Urgency, value: number | null, since: string, valueIsEstimate = false): WorkItem => ({
  id, lane: 'sales', stage: 'enquiry', verb: 'reply', blockedBy: 'us', since, dueAt: null, urgency, value, valueIsEstimate,
  orderId: null, personId: null, conversationId: null, title: id, ref: null, blocker: '', draftReady: false, ownerId: null,
});

// 12-item fixture (B.2): f (est. £4,000 → 2000) ties l on value and wins on age.
export const RANK_FIXTURE: WorkItem[] = [
  item('a', 'waiting', 9000, '2026-10-01'), item('b', 'ok', 100, '2026-10-01'), item('c', 'overdue', 500, '2026-10-05'),
  item('d', 'overdue', 500, '2026-10-02'), item('e', 'due', 3000, '2026-10-10'), item('f', 'overdue', 4000, '2026-10-10', true),
  item('g', 'overdue', 2500, '2026-10-10'), item('h', 'due', null, '2026-10-01'), item('i', 'ok', 100, '2026-10-01'),
  item('j', 'waiting', 50, '2026-09-01'), item('k', 'due', 0, '2026-09-01'), item('l', 'overdue', 2000, '2026-10-12'),
];

describe('rank', () => {
  it('urgency, then value (estimate ×0.5, null = 0), then oldest, then id', () => {
    expect(rank(RANK_FIXTURE, NOW).map((i) => i.id).join('')).toBe('gfldcekhbiaj');
  });
  it('is stable regardless of input order and does not mutate', () => {
    const copy = [...RANK_FIXTURE].reverse();
    expect(rank(copy, NOW).map((i) => i.id)).toEqual(rank(RANK_FIXTURE, NOW).map((i) => i.id));
    expect(copy[0].id).toBe('l');
  });
});
