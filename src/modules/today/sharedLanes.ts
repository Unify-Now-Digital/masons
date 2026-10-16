/**
 * Hub Sales / CS lanes = the shared priority lists (src/shared/priority), verbatim:
 * same membership, order, reason text, pill label and cap as the Inbox Priority view.
 * The Hub adds nothing of its own (no tier, no label) to these lanes.
 */
import type { SharedPriorityRow } from '@/shared/priority/lanes';
import { annotateItem, Tier, type Colour, type Lane, type TodayItem, type Verb } from './todayModel';

export const SHARED_LANES: Lane[] = ['Sales', 'CS'];
const colour = (t: SharedPriorityRow['action']['tone'], kind: string): Colour =>
  kind === 'waiting' ? 'blue' : t === 'red' ? 'red' : t === 'amber' ? 'amber' : 'blue';

/** Drop £ amounts before a non-owner sees a shared Sales or CS row. */
export function withoutMoney(rows: SharedPriorityRow[]): SharedPriorityRow[] {
  return rows.map((row) => ({
    ...row,
    value: null,
    valueIsGuess: false,
    why: row.why.replace(/£\s?\d[\d,]*(?:\.\d+)?/g, '').replace(/[ \t]{2,}/g, ' ').trim(),
  }));
}

export function hubLaneItems(rows: SharedPriorityRow[], lane: Lane, now: number): TodayItem[] {
  return rows.map((r) => annotateItem({
    key: r.key,
    lane,
    name: r.name,
    // The pill shows the shared label verbatim (not a Hub verb).
    verb: r.action.label as Verb,
    colour: colour(r.action.tone, r.action.kind),
    tier: Tier.Waiting, // unused for shared lanes (no tier headers)
    why: r.why,
    valueGbp: r.value,
    lastInAt: r.lastInAt ?? null,
    lastOutAt: r.lastOutAt ?? null,
    sinceAt: r.since,
    to: r.orderId ? `/dashboard/orders?order=${encodeURIComponent(r.orderId)}` : '/dashboard/inbox',
    orderId: r.orderId ?? null,
    personId: r.personId,
    conversationId: r.conversationId,
  }, now, 0));
}
