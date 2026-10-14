/**
 * Hub Sales / CS lanes = the shared priority lists (src/shared/priority), verbatim:
 * same membership, order, reason text, pill label and cap as the Inbox Priority view.
 * The Hub adds nothing of its own (no tier, no label) to these lanes.
 */
import type { SharedPriorityRow } from '@/shared/priority/lanes';
import { Tier, type Colour, type Lane, type TodayItem, type Verb } from './todayModel';

export const SHARED_LANES: Lane[] = ['Sales', 'CS'];
const colour = (t: SharedPriorityRow['action']['tone'], kind: string): Colour =>
  kind === 'waiting' ? 'blue' : t === 'red' ? 'red' : t === 'amber' ? 'amber' : 'blue';
const days = (iso: string | null | undefined, now: number) => {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.floor((now - n) / 86_400_000)) : null;
};

export function hubLaneItems(rows: SharedPriorityRow[], lane: Lane, now: number): TodayItem[] {
  return rows.map((r) => ({
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
    daysSinceOut: days(r.lastOutAt, now),
    quietDays: days(r.since, now) ?? 0,
    carriedDays: 0,
  }));
}
