import { describe, expect, it } from 'vitest';
import { REPLY_SLA_HOURS } from '@/shared/lib/replySla';
import { addWorkingHours, computeDueAt, computeUrgency, elapsedHours, slaLabel } from './sla';

const NOW = new Date('2026-10-15T12:00:00Z'); // Thursday
const hAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe('computeUrgency', () => {
  it('reply timers come only from replySla.ts', () => {
    const base = { lane: 'sales' as const, stage: 'enquiry' as const, verb: 'reply' as const, blockedBy: 'us' as const };
    const sla = REPLY_SLA_HOURS.Sales;
    expect(computeUrgency({ ...base, since: hAgo(sla * 0.5) }, NOW)).toBe('ok');
    expect(computeUrgency({ ...base, since: hAgo(sla * 0.8) }, NOW)).toBe('due');
    expect(computeUrgency({ ...base, since: hAgo(sla + 1) }, NOW)).toBe('overdue');
    expect(computeUrgency({ lane: 'cs', stage: 'family_waiting', verb: 'reply', blockedBy: 'us', since: hAgo(REPLY_SLA_HOURS.CS + 1) }, NOW)).toBe('overdue');
  });
  it('quote has no timer → ok', () => {
    expect(computeUrgency({ lane: 'sales', stage: 'enquiry', verb: 'quote', blockedBy: 'us', since: hAgo(500) }, NOW)).toBe('ok');
  });
  it('blocked by them: waiting until breached, then overdue', () => {
    const b = { lane: 'proof' as const, stage: 'sent' as const, verb: 'chase_proof' as const, blockedBy: 'them' as const };
    expect(computeUrgency({ ...b, since: hAgo(71) }, NOW)).toBe('waiting');
    expect(computeUrgency({ ...b, since: hAgo(72) }, NOW)).toBe('overdue');
  });
  it('blockedBy none → ok', () => {
    expect(computeUrgency({ lane: 'proof', stage: 'sent', verb: 'chase_proof', blockedBy: 'none', since: hAgo(999) }, NOW)).toBe('ok');
  });
});

describe('working days', () => {
  it('weekends contribute no elapsed hours', () => {
    const fri = new Date(2026, 9, 16, 12); const mon = new Date(2026, 9, 19, 12);
    expect(elapsedHours(fri.toISOString(), mon, true)).toBeCloseTo(24, 5);
    expect(elapsedHours(fri.toISOString(), mon, false)).toBeCloseTo(72, 5);
  });
  it('addWorkingHours skips the weekend and inverts elapsedHours', () => {
    const fri = new Date(2026, 9, 16, 12);
    const due = addWorkingHours(fri, 24);
    expect(due.getDay()).toBe(1);
    expect(elapsedHours(fri.toISOString(), due, true)).toBeCloseTo(24, 5);
  });
  it('dueAt for council submitted uses working days', () => {
    const since = new Date(2026, 9, 16, 12).toISOString();
    const due = computeDueAt({ lane: 'permit', stage: 'submitted', verb: 'chase_council', blockedBy: 'them', since }, NOW)!;
    expect(Date.parse(due) - Date.parse(since)).toBeGreaterThan(240 * 3_600_000);
  });
});

describe('slaLabel', () => {
  it('formats over / left / waiting', () => {
    expect(slaLabel({ lane: 'permit', stage: 'not_started', verb: 'send_permit', blockedBy: 'us', since: hAgo(9 * 24), urgency: 'overdue' }, NOW)).toBe('9d · 7d over');
    expect(slaLabel({ lane: 'sales', stage: 'enquiry', verb: 'reply', blockedBy: 'us', since: hAgo(20), urgency: 'due' }, NOW)).toBe('20h · 4h left');
    expect(slaLabel({ lane: 'proof', stage: 'sent', verb: 'chase_proof', blockedBy: 'them', since: hAgo(72), urgency: 'waiting' }, NOW)).toBe('waiting 3d');
  });
});
