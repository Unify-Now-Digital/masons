import { describe, expect, it } from 'vitest';
import { Tier, type TodayItem } from './todayModel';
import { chipTone, lateCount, noDraftMark, queueGroups, timingOf } from './queueView';

const NOW = Date.parse('2026-10-15T12:00:00Z');

function item(p: Partial<TodayItem> & Pick<TodayItem, 'key' | 'bucket' | 'lateBy'>): TodayItem {
  return {
    lane: 'Sales', name: p.key, verb: 'REPLY', colour: 'red', tier: Tier.Waiting, why: p.key, to: '/',
    daysSinceOut: null, quietDays: 0, carriedDays: 0, sinceAt: null,
    kind: 'reply', waitingOn: 'us', waitingSince: new Date(NOW),
    reasons: [], factors: [], evidence: [], short: 'message', ...p,
  };
}

describe('queue view', () => {
  const rows = [
    item({ key: 'old', bucket: 'old', lateBy: 200, kind: 'call' }),
    item({ key: 'fix', bucket: 'fix', lateBy: 10, kind: 'fix', waitingOn: 'record', lane: 'Finance' }),
    item({ key: 'today-soon', bucket: 'today', lateBy: -2 }),
    item({ key: 'late-them', bucket: 'late', lateBy: 5, kind: 'chase', waitingOn: 'them' }),
    item({ key: 'today-later', bucket: 'today', lateBy: -20 }),
    item({ key: 'late-us', bucket: 'late', lateBy: 40 }),
  ];

  it('orders urgency groups and hides empty ones', () => {
    expect(queueGroups(rows, 'urgency', NOW).map((g) => [g.id, g.items.map((i) => i.key)])).toEqual([
      ['late', ['late-us', 'late-them']],
      ['today', ['today-soon', 'today-later']],
      ['fix', ['fix']],
      ['old', ['old']],
    ]);
    expect(queueGroups(rows.filter((r) => r.bucket !== 'fix'), 'urgency', NOW).map((g) => g.id)).toEqual(['late', 'today', 'old']);
  });

  it('counts late and long-overdue rows, not records to fix', () => {
    expect(lateCount(rows)).toBe(3);
    expect(lateCount(rows.filter((r) => r.bucket === 'fix'))).toBe(0);
  });

  it('tones the chip and the timing line', () => {
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(chipTone(by['late-us'], false)).toBe('late-us');
    expect(chipTone(by['late-them'], false)).toBe('late-them');
    expect(chipTone(by['today-soon'], false)).toBe('today');
    expect(chipTone(by['fix'], false)).toBe('fix');
    expect(chipTone(by.old, false)).toBe('old');
    expect(chipTone(by['late-us'], true)).toBe('done');
    expect(timingOf(by['late-us'], undefined)).toEqual({ text: '40h late', tone: 'late' });
    expect(timingOf(by['late-us'], 'Sent')).toEqual({ text: 'Sent', tone: 'done' });
    expect(timingOf(by['today-soon'], undefined)).toEqual({ text: '2h left', tone: 'soon' });
    expect(timingOf(item({ key: 'due', bucket: 'today', lateBy: 0 }), undefined)).toEqual({ text: 'Due today', tone: 'soon' });
    expect(timingOf(by.fix, undefined)).toEqual({ text: 'Record', tone: 'soon' });
    expect(timingOf(by.old, undefined).tone).toBe('old');
    expect(noDraftMark(by['late-us'])).toBeNull();
    expect(noDraftMark({ ...by['late-us'], prepared: { type: 'message' } } as TodayItem)).toBeNull();
    expect(noDraftMark({ ...by['late-us'], prepared: null } as TodayItem)).toBe('No draft');
  });
});
