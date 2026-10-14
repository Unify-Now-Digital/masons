import { describe, expect, it } from 'vitest';
import { buildPlan, permitStageCounts, type PlanInput } from './hubPlan';

const base = (k: string, o: Partial<PlanInput> = {}): PlanInput => ({
  key: k, team: 'Finance', name: k, context: '', explanation: '', to: '/',
  action: { kind: 'deposit', label: 'Request deposit', reason: '', tone: 'neutral' }, waitingMs: 0, ball: 'us', ...o,
});

describe('buildPlan', () => {
  it('caps per team, deadlines first and always planned', () => {
    const now = Date.parse('2026-10-14T10:00:00Z');
    const p = buildPlan([
      base('a', { waitingMs: 5 }), base('b', { waitingMs: 9 }), base('c', { waitingMs: 1 }),
      base('d', { deadlineAt: '2026-10-18T00:00:00Z' }),
    ], now);
    expect(p.today.map((i) => i.key)).toEqual(['d', 'b', 'a']);
    expect(p.tomorrow.map((i) => i.key)).toEqual(['c']);
    expect(p.hardDeadlines).toBe(1);
    expect(p.byTeam.Finance).toEqual({ planned: 3, total: 4 });
  });
  it('maps permit statuses', () => {
    expect(permitStageCounts(['not_started', 'pending', 'pending', 'customer_completed', null])).toMatchObject({ needs: 1, council: 2, returned: 1, ready: 0 });
  });
});
