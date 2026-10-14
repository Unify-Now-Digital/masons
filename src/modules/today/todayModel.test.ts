import { describe, expect, it } from 'vitest';
import { ballOnUs, buildToday, headerText, LANE_CAPS, Tier, updateSeen, type TodayInput } from './todayModel';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const mk = (k: string, p: Partial<TodayInput> = {}): TodayInput => ({
  key: k, lane: 'Sales', name: k, verb: 'REPLY', colour: 'red', tier: Tier.Waiting, why: '', to: '/', sinceAt: ago(1), ...p,
});

describe('todayModel', () => {
  it('ranks: issue/date > waiting on us > money > new enquiry > quiet quote (by value) > waiting > hold', () => {
    const p = buildToday([
      mk('hold', { tier: Tier.OnHold }), mk('q-small', { tier: Tier.QuietQuote, valueGbp: 900 }), mk('q-big', { tier: Tier.QuietQuote, valueGbp: 5000 }),
      mk('new', { tier: Tier.NewEnquiry }), mk('money', { tier: Tier.MoneyDue }), mk('wait', { tier: Tier.WaitingOnUs }), mk('date', { tier: Tier.IssueOrHardDate }),
    ], NOW);
    expect(p.today.Sales.map((i) => i.key)).toEqual(['date', 'wait', 'money', 'new', 'q-big', 'q-small', 'hold']);
  });
  it('caps per lane and keeps the rest for later', () => {
    const items = Array.from({ length: 40 }, (_, n) => mk(`s${n}`));
    const p = buildToday([...items, ...Array.from({ length: 9 }, (_, n) => mk(`f${n}`, { lane: 'Finance' }))], NOW);
    expect(p.today.Sales).toHaveLength(LANE_CAPS.Sales);
    expect(p.later.Sales).toHaveLength(25);
    expect(p.today.Finance).toHaveLength(5);
    expect(p.toDo).toBe(20);
  });
  it('quiet 60+ → Abandoned?, 90+ → close or re-quote, never on Today; hard dates stay', () => {
    const p = buildToday([
      mk('a', { staleable: true, sinceAt: ago(70) }), mk('c', { staleable: true, sinceAt: ago(120), lastOutAt: ago(95) }),
      mk('fresh', { staleable: true, lastInAt: ago(3) }), mk('d', { staleable: true, sinceAt: ago(200), tier: Tier.IssueOrHardDate }),
    ], NOW);
    expect(p.abandoned.map((i) => i.key)).toEqual(['a']);
    expect(p.closeOrRequote.map((i) => i.key)).toEqual(['c']);
    expect(p.today.Sales.map((i) => i.key).sort()).toEqual(['d', 'fresh']);
  });
  it('carried-over day count from the first-seen map, and plain header text', () => {
    const p1 = buildToday([mk('x'), mk('y')], NOW);
    const seen = updateSeen({}, p1, NOW - 2 * 86_400_000);
    const p2 = buildToday([mk('x'), mk('y'), mk('z')], NOW, seen);
    expect(p2.today.Sales.find((i) => i.key === 'x')!.carriedDays).toBe(2);
    expect(p2.carried).toBe(2);
    expect(headerText(p2)).toBe('3 to do today · 2 carried over');
  });
  it('ball on us only when they wrote after our last message out', () => {
    expect(ballOnUs(ago(1), ago(2))).toBe(true);
    expect(ballOnUs(ago(2), ago(1))).toBe(false);
    expect(ballOnUs(ago(2), null)).toBe(true);
    expect(ballOnUs(null, ago(1))).toBe(false);
  });
});
