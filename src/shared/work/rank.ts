/**
 * One sort everywhere (B.2). Replaces/wraps the 19 ranking functions found in Phase 0
 * (docs/work-model-map.md §3) — that replacement itself happens screen-by-screen in Phases
 * D–H; this file is the single comparator they all converge on.
 */
import type { Urgency, WorkItem } from './types';

const URGENCY_ORDER: Record<Urgency, number> = { overdue: 0, due: 1, ok: 2, waiting: 3 };

/** null value counts as 0; an estimate counts as its value × 0.5. */
function rankValue(item: Pick<WorkItem, 'value' | 'valueIsEstimate'>): number {
  const v = item.value ?? 0;
  return item.valueIsEstimate ? v * 0.5 : v;
}

/**
 * 1. urgency: overdue > due > ok > waiting
 * 2. within the same urgency: value desc
 * 3. then: since asc (oldest first)
 * 4. tie-break: id asc (stable)
 * `now` is accepted for signature parity with the spec; ordering is a pure function of each
 * item's already-computed `urgency` (set by sla.ts ahead of ranking).
 */
export function rank(items: WorkItem[], _now: Date): WorkItem[] {
  return [...items].sort((a, b) => {
    const u = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (u !== 0) return u;
    const v = rankValue(b) - rankValue(a);
    if (v !== 0) return v;
    const s = (Date.parse(a.since) || 0) - (Date.parse(b.since) || 0);
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  });
}

export const DAILY_CAP = 15;
