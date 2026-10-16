import { describe, expect, it } from 'vitest';
import { Tier, type TodayItem } from './todayModel';
import { itemNeed, kickerText, laneRule, waitingText } from './detailText';

const NOW = new Date('2026-10-15T12:00:00Z');

function item(p: Partial<TodayItem> & Pick<TodayItem, 'key' | 'lane' | 'name'>): TodayItem {
  return {
    verb: 'REPLY', colour: 'red', tier: Tier.Waiting, why: p.name, to: '/',
    daysSinceOut: null, quietDays: 0, carriedDays: 0, sinceAt: null,
    kind: 'reply', bucket: 'today', waitingOn: 'us', waitingSince: new Date('2026-10-09T12:00:00Z'), lateBy: 0,
    reasons: [], factors: [], evidence: [], short: 'message', ...p,
  };
}

describe('detail text', () => {
  it('names who we are waiting on, without an hour count', () => {
    const us = item({ key: 'a', lane: 'Sales', name: 'Ada', waitingOn: 'us' });
    const them = item({ key: 'b', lane: 'CS', name: 'Bea', waitingOn: 'them' });
    const record = item({ key: 'c', lane: 'Finance', name: 'Cleo', waitingOn: 'record' });
    expect(waitingText(us, NOW)).toMatch(/^Waiting on us since /);
    expect(waitingText(them, NOW)).toMatch(/^Waiting on them since /);
    expect(waitingText(record, NOW)).toBe('Our record, no customer contact');
    expect(`${waitingText(us, NOW)} ${laneRule('Finance')} ${laneRule('Proofs')}`).not.toMatch(/SLA|72h/);
    expect(laneRule('Proofs')).toBe('We aim to reply within a day');
    expect(laneRule('Finance')).toBe('We aim to reply within three days');
  });

  it('shows the chase rule on a chase, never the reply aim', () => {
    expect(laneRule('Sales', 'chase')).toBe('We chase quotes after 3 quiet days.');
    expect(laneRule('Sales', 'chase')).not.toMatch(/aim to reply/);
    expect(laneRule('CS', 'chase')).not.toMatch(/aim to reply/);
    expect(laneRule('Proofs', 'chase')).not.toMatch(/aim to reply/);
    expect(laneRule('Sales', 'reply')).toBe('We aim to reply within a day');
  });

  it('builds the kicker from lane, reference and whole pounds', () => {
    const row = item({ key: 'a', lane: 'Sales', name: 'Ada', ref: 'ENQ-12', valueGbp: 5000, why: 'grey granite price', short: 'grey granite price' });
    expect(kickerText(row)).toBe('Sales · ENQ-12 · £5,000');
    expect(itemNeed(row)).toBe('grey granite price');
  });
});
