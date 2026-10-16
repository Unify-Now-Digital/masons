/**
 * Copy for the Today detail pane. Dates are en-GB, with no year in the current year.
 * Nothing here says "SLA" or prints an hour count.
 */
import { CHASE_RULE_TEXT, LANE_RULE_TEXT, type SlaLane } from '@/shared/lib/replySla';
import { gbp0 } from './uiHelpers';
import type { TodayItem } from './todayModel';

const VERB_WORD = /^(reply|call|chase|send|order|fix|confirm|quote|invoice|flag|waiting|follow|match|request|record|acknowledge|submit|soft)\b[\s:,.+\-–]*/i;

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Object phrase, verb stripped. `need` is this, clipped to 48 characters. */
export function objectPhrase(item: Pick<TodayItem, 'asked' | 'why' | 'subject' | 'ref' | 'short'>): string {
  const asked = item.asked?.split('·')[0]?.trim();
  let raw = (asked || item.why || item.subject || item.short || '').replace(VERB_WORD, '').trim();
  if (!raw) raw = item.ref && item.ref !== '—' ? item.ref : 'this';
  raw = raw.charAt(0).toLowerCase() + raw.slice(1);
  if (/^(reply|call|chase|send|order|fix)\b/i.test(raw)) {
    raw = raw.replace(/^(reply|call|chase|send|order|fix)\b[\s:,.+\-–]*/i, '').trim();
  }
  return raw || 'this';
}

export function itemNeed(item: Pick<TodayItem, 'asked' | 'why' | 'subject' | 'ref' | 'short'>): string {
  return clip(objectPhrase(item), 48);
}

export function itemNeedLong(item: Pick<TodayItem, 'asked' | 'why' | 'subject' | 'ref' | 'short'>): string {
  const why = item.why?.replace(/\s+/g, ' ').trim();
  return why || objectPhrase(item);
}

export function capitalise(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDay(date: Date, now: Date): string {
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatWhen(date: Date, now: Date): string {
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${formatDay(date, now)}, ${time}`;
}

export function kickerText(item: TodayItem): string {
  const parts: string[] = [item.lane];
  if (item.ref && item.ref !== '—') parts.push(item.ref);
  if (item.valueGbp != null && Number.isFinite(item.valueGbp) && item.valueGbp > 0) parts.push(gbp0(item.valueGbp));
  return parts.join(' · ');
}

export function rankLabel(rank: number, total: number): string {
  return `#${rank} of ${total}`;
}

export function waitingText(item: Pick<TodayItem, 'waitingOn' | 'waitingSince'>, now: Date): string {
  if (item.waitingOn === 'record') return 'Our record, no customer contact';
  const day = formatDay(item.waitingSince, now);
  if (item.waitingOn === 'them') return `Waiting on them since ${day}`;
  return `Waiting on us since ${day}`;
}

/** Reply lanes use the reply sentence. A chase never does — it uses the lane's chase rule. */
export function laneRule(lane: string, kind?: string): string {
  if (kind === 'chase') {
    if (lane in CHASE_RULE_TEXT) return CHASE_RULE_TEXT[lane as keyof typeof CHASE_RULE_TEXT];
    return CHASE_RULE_TEXT.Sales;
  }
  if (lane in LANE_RULE_TEXT) return LANE_RULE_TEXT[lane as SlaLane];
  return LANE_RULE_TEXT.Sales;
}

export function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
