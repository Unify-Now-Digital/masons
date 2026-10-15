import { describe, expect, it } from 'vitest';
import { Tier, type TodayItem } from './todayModel';
import { mergeLater, peopleLateCount, personGroups, taskMark, toPersonRows } from './personRows';

const NOW = Date.parse('2026-10-15T12:00:00Z');

function item(p: Partial<TodayItem> & Pick<TodayItem, 'key' | 'lane' | 'name'>): TodayItem {
  return {
    verb: 'REPLY', colour: 'red', tier: Tier.Waiting, why: p.name, to: '/',
    daysSinceOut: null, quietDays: 0, carriedDays: 0, sinceAt: null,
    kind: 'reply', bucket: 'today', waitingOn: 'us', waitingSince: new Date(NOW), lateBy: 0,
    reasons: [], factors: [], evidence: [], short: 'message', ...p,
  };
}

describe('person rows', () => {
  const tasks = [
    item({ key: 'pay', lane: 'Finance', name: 'Ada', personId: 'ada', bucket: 'fix', kind: 'fix', lateBy: 1, orderId: 'o1', short: 'deposit' }),
    item({ key: 'proof', lane: 'Proofs', name: 'Ada', personId: 'ada', bucket: 'late', kind: 'send', lateBy: 20, orderId: 'o1', short: 'proof' }),
    item({ key: 'permit', lane: 'Permits', name: 'Ada', personId: 'ada', bucket: 'today', kind: 'send', lateBy: -2, orderId: 'o1', short: 'form' }),
    item({ key: 'enq', lane: 'Sales', name: 'Bea', personId: 'bea', bucket: 'today', kind: 'reply', lateBy: -1, short: 'price' }),
  ];

  it('keeps one row per person, customer when any task has an order', () => {
    const rows = toPersonRows(tasks, NOW, {});
    expect(rows.map((row) => row.name)).toEqual(['Ada', 'Bea']);
    expect(rows[0].customer).toBe(true);
    expect(rows[0].system).toBe(false);
    expect(rows[1].customer).toBe(false);
    expect(rows[1].system).toBe(false);
    expect(rows[0].tasks.map((task) => taskMark(task))).toEqual(['proof', 'permit', 'payment']);
    expect(rows[0].lead.key).toBe('proof');
  });

  it('takes urgency from the most urgent task that is still open', () => {
    const rows = toPersonRows(tasks, NOW, { proof: 'Sent' });
    const ada = rows.find((row) => row.name === 'Ada');
    expect(ada?.lead.key).toBe('permit');
    expect(ada?.done).toBe(false);
    expect(ada?.tasks.map((task) => task.key)).toEqual(['permit', 'pay', 'proof']);
    expect(rows[0].name).toBe('Bea');
    const done = toPersonRows(tasks.filter((task) => task.personId === 'bea'), NOW, { enq: 'Sent' });
    expect(done[0].done).toBe(true);
    expect(done[0].doneVerb).toBe('Sent');
  });

  it('counts late people from the lead task and groups by that bucket', () => {
    const rows = toPersonRows(tasks, NOW, {});
    expect(peopleLateCount(rows)).toBe(1);
    expect(personGroups(rows, 'urgency').map((group) => group.id)).toEqual(['late', 'today']);
    expect(personGroups(rows, 'person')[0].title).toBe('');
    expect(personGroups(rows, 'lane').map((group) => group.id)).toEqual(['Sales', 'Proofs']);
  });

  it('treats a row with no person and no order as a system row', () => {
    const rows = toPersonRows([
      item({ key: 'fin:void-in-stripe', lane: 'Finance', name: '10 invoices void in Stripe', kind: 'fix', verb: 'FLAG' }),
    ], NOW, {});
    expect(rows[0].system).toBe(true);
    expect(rows[0].customer).toBe(false);
  });

  it('folds later tasks onto a person who is already listed', () => {
    const primary = toPersonRows([tasks[1]], NOW, {});
    const later = toPersonRows([tasks[0], tasks[2]], NOW, {});
    const merged = mergeLater(primary, later, NOW, {});
    expect(merged.rows).toHaveLength(1);
    expect(merged.rows[0].tasks.map((task) => task.key).sort()).toEqual(['pay', 'permit', 'proof']);
    expect(merged.laterOnly).toHaveLength(0);
  });
});
