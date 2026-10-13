import {
  needsUs,
  nextActionForEnquiry,
  nextActionForOrder,
  replyTimerText,
  type NextAction,
  type TimerText,
} from '@/shared/lib/nextAction';
import { BUCKET_SLA, type AgingInfo, type InboxBucket } from './inboxBuckets';

/** Minimal order shape (subset of orders + job join) the Inbox row needs. */
export interface InboxOrderLike {
  person_id: string | null;
  deposit_date: string | null;
  second_payment_date: string | null;
  stone_status: string | null;
  permit_status: string | null;
  proof_status: string | null;
  installation_date: string | null;
  job?: { stage: string | null; paid_at: string | null; exit_reason: string | null } | null;
}

export interface InboxRowAction {
  action: NextAction;
  timer: TimerText | null;
}

/** Order kinds by stage order — the earliest blocking one wins across a person's orders. */
const KIND_RANK: Record<string, number> = { deposit: 0, permit: 1, proof: 2, balance: 3, waiting: 4, none: 5 };

/**
 * Inbox row next action: a person's open orders decide when they have one that needs
 * us; otherwise the reply turn decides (Follow up enquiry / Waiting). The timer is the
 * existing per-bucket SLA aging, expressed in words.
 */
export function inboxRowAction(
  aging: { bucket: InboxBucket; aging: AgingInfo | null } | null,
  personOrders: InboxOrderLike[],
  now: Date = new Date(),
): InboxRowAction {
  const side = aging?.aging?.ball.side ?? null;
  const timer = aging?.aging
    ? replyTimerText(aging.aging.ball.side, aging.aging.ball.sinceMs, BUCKET_SLA[aging.bucket].usOwesMs)
    : null;

  let best: NextAction | null = null;
  for (const o of personOrders) {
    const a = nextActionForOrder(
      {
        jobStage: o.job?.stage ?? null,
        jobExitReason: o.job?.exit_reason ?? null,
        jobPaidAt: o.job?.paid_at ?? null,
        depositDate: o.deposit_date,
        secondPaymentDate: o.second_payment_date,
        stoneStatus: o.stone_status,
        permitStatus: o.permit_status,
        proofStatus: o.proof_status,
        installationDate: o.installation_date,
      },
      now,
    );
    if (!best || KIND_RANK[a.kind] < KIND_RANK[best.kind]) best = a;
  }

  // A customer owed a reply still needs us even if their order is waiting elsewhere.
  if (best && needsUs(best)) return { action: best, timer };
  const enquiry = nextActionForEnquiry({ side, agingLevel: aging?.aging?.level ?? null });
  if (best && best.kind === 'waiting' && enquiry.kind !== 'follow') return { action: best, timer };
  return { action: enquiry, timer };
}

export interface InboxCue {
  needYou: number;
  overdue: number;
  dueSoon: number;
}

export function inboxCue(rows: InboxRowAction[]): InboxCue {
  let needYou = 0, overdue = 0, dueSoon = 0;
  for (const r of rows) {
    if (!needsUs(r.action)) continue;
    needYou += 1;
    if (r.timer?.tone === 'over') overdue += 1;
    else if (r.timer?.tone === 'soon') dueSoon += 1;
  }
  return { needYou, overdue, dueSoon };
}

/** Ball position used for ordering rows (from the existing aging; null = no aging). */
export interface RowWait {
  side: 'us' | 'them';
  sinceMs: number;
}

/**
 * Inbox order (Arin, 2026-10-14): chased first — the customer is waiting on us —
 * then longest wait. Rows waiting on them follow (longest first); rows with no
 * aging keep their original order at the end. Stable.
 */
export function sortChasedFirst<T>(rows: T[], waitOf: (row: T) => RowWait | null): T[] {
  const rank = (w: RowWait | null) => (w == null ? 2 : w.side === 'us' ? 0 : 1);
  return rows
    .map((row, i) => ({ row, i, w: waitOf(row) }))
    .sort((a, b) => rank(a.w) - rank(b.w) || (b.w?.sinceMs ?? 0) - (a.w?.sinceMs ?? 0) || a.i - b.i)
    .map((x) => x.row);
}
