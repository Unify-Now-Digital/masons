/**
 * SLA + urgency (B.1). Two independent sources, never mixed (Decision 1, binding):
 *  - Reply timers (verb === 'reply', sales + cs only) come ONLY from replySla.ts.
 *  - Everything else (chase/stage timers) comes from the SLA table below, and ONLY for the
 *    four categories the map's own instruction names: permit stages, proof stages, payment
 *    stages, and the sales 'quoted' chase. Sales 'enquiry' has no stage SLA entry here — its
 *    two verbs are 'reply' (replySla) and 'quote' (no timer), so adding one would just
 *    redefine the 24h replySla number a second time, which Decision 1 forbids.
 */
import { REPLY_SLA_HOURS } from '@/shared/lib/replySla';
import { LANE_SLA_KEY, type BlockedBy, type Lane, type Urgency, type WorkItem } from './types';
import type { Stage } from './stages';

export interface StageSla { hours: number; workingDays?: boolean }

export const SLA: Partial<Record<Lane, Partial<Record<Stage, StageSla>>>> = {
  sales: { quoted: { hours: 72 } },
  permit: {
    not_started: { hours: 48 },
    form_sent: { hours: 168 },
    with_family: { hours: 168 }, // same A.4 row as form_sent ("form_sent / with_family")
    submitted: { hours: 240, workingDays: true },
    rejected: { hours: 24 },
  },
  proof: {
    not_started: { hours: 72 },
    sent: { hours: 72 },
    changes_requested: { hours: 48 },
  },
  payment: {
    not_invoiced: { hours: 24 },
    deposit_due: { hours: 168 },
    balance_due: { hours: 168 },
  },
};

export const DUE_SOON_RATIO = 0.75; // ≥75% of SLA elapsed → 'due'

const HOUR_MS = 3_600_000;

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Hours elapsed from `fromIso` to `now`. When `workingDays` is set, weekend calendar days
 * (Sat/Sun) contribute 0h; weekdays contribute their actual elapsed hours, including partial
 * first/last days. UK bank holidays: TODO (out of scope, B.1) — not subtracted.
 */
export function elapsedHours(fromIso: string | null | undefined, now: Date, workingDays = false): number {
  if (!fromIso) return 0;
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return 0;
  if (now.getTime() <= from.getTime()) return 0;
  if (!workingDays) return (now.getTime() - from.getTime()) / HOUR_MS;

  let hours = 0;
  const cursor = new Date(from);
  while (cursor.getTime() < now.getTime()) {
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    const segmentEndMs = Math.min(dayEnd.getTime() + 1, now.getTime());
    if (!isWeekend(cursor)) hours += (segmentEndMs - cursor.getTime()) / HOUR_MS;
    cursor.setTime(dayEnd.getTime() + 1);
  }
  return Math.max(0, hours);
}

type SlaItem = Pick<WorkItem, 'lane' | 'stage' | 'verb' | 'blockedBy' | 'since'>;

/** The SLA that applies to this item, or null when none does (e.g. sales 'quote'). */
function slaFor(item: SlaItem): StageSla | null {
  // Reconcile rows sit on a placeholder stage (see adapters.ts); they carry no stage clock.
  if (item.verb === 'reconcile') return null;
  if (item.verb === 'reply') {
    const key = LANE_SLA_KEY[item.lane];
    if (!key) return null;
    return { hours: REPLY_SLA_HOURS[key] };
  }
  return SLA[item.lane]?.[item.stage] ?? null;
}

/**
 * blockedBy 'us':   elapsed ≥ SLA → overdue; ≥75% → due; else ok.
 * blockedBy 'them': elapsed ≥ SLA → overdue (now our move to chase); else waiting.
 * blockedBy 'none', or no SLA applies to 'them': ok / waiting respectively, no breach clock.
 */
export function computeUrgency(item: SlaItem, now: Date): Urgency {
  if (item.blockedBy === 'none') return 'ok';
  const sla = slaFor(item);
  if (!sla) return item.blockedBy === 'them' ? 'waiting' : 'ok';
  const elapsed = elapsedHours(item.since, now, sla.workingDays);
  if (item.blockedBy === 'them') return elapsed >= sla.hours ? 'overdue' : 'waiting';
  if (elapsed >= sla.hours) return 'overdue';
  if (elapsed >= sla.hours * DUE_SOON_RATIO) return 'due';
  return 'ok';
}

/** since + SLA hours, as an ISO string; null when no SLA applies. */
export function computeDueAt(item: SlaItem, now: Date): string | null {
  const sla = slaFor(item);
  if (!sla) return null;
  const from = Date.parse(item.since);
  if (Number.isNaN(from)) return null;
  if (!sla.workingDays) return new Date(from + sla.hours * HOUR_MS).toISOString();
  return addWorkingHours(new Date(from), sla.hours).toISOString();
}

/** Inverse of elapsedHours(…, workingDays=true): weekend days contribute no hours. */
export function addWorkingHours(from: Date, hours: number): Date {
  let left = hours * HOUR_MS;
  const cursor = new Date(from);
  for (let guard = 0; guard < 10_000; guard++) {
    const dayEnd = new Date(cursor);
    dayEnd.setHours(23, 59, 59, 999);
    const segment = dayEnd.getTime() + 1 - cursor.getTime();
    if (!isWeekend(cursor)) {
      if (left <= segment) return new Date(cursor.getTime() + left);
      left -= segment;
    }
    cursor.setTime(dayEnd.getTime() + 1);
  }
  return cursor;
}

function fmtDuration(hours: number): string {
  const h = Math.max(0, Math.round(hours));
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** "9d · 7d over", "20h · 4h left", or "waiting 3d". The one SLA string for every row. */
export function slaLabel(item: SlaItem & { urgency: Urgency }, now: Date): string {
  const sla = slaFor(item);
  const elapsed = elapsedHours(item.since, now, sla?.workingDays);
  if (item.urgency === 'waiting') return `waiting ${fmtDuration(elapsed)}`;
  if (!sla) return fmtDuration(elapsed);
  if (item.urgency === 'overdue') return `${fmtDuration(elapsed)} · ${fmtDuration(elapsed - sla.hours)} over`;
  return `${fmtDuration(elapsed)} · ${fmtDuration(Math.max(0, sla.hours - elapsed))} left`;
}

/** Stamps dueAt + urgency onto an adapter's output (adapters set a placeholder for both). */
export function withUrgency<T extends SlaItem>(item: T, now: Date): T & { dueAt: string | null; urgency: Urgency } {
  return { ...item, dueAt: computeDueAt(item, now), urgency: computeUrgency(item, now) };
}

export type { BlockedBy };
