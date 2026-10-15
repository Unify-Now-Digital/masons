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
  /** Loaded when the orders query returns it. Omitted → do not invent a Get inscription step. */
  inscription_text?: string | null;
  installation_date: string | null;
  /** Invoice the order is on (deposit / balance steps deep-link to its Collect payment). */
  invoice_id?: string | null;
  job?: { stage: string | null; paid_at: string | null; exit_reason: string | null } | null;
}

export interface InboxRowAction {
  action: NextAction;
  timer: TimerText | null;
  /** The order that decided an order-kind action (deposit / balance / …), when one did. */
  order?: InboxOrderLike | null;
}

/** Order kinds by stage order — the earliest blocking one wins across a person's orders. */
const KIND_RANK: Record<string, number> = {
  deposit: 0, stone: 1, inscription: 2, permit: 3, proof: 4, balance: 5, waiting: 6, none: 7,
};

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
  let bestOrder: InboxOrderLike | null = null;
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
        inscriptionText: o.inscription_text,
        installationDate: o.installation_date,
      },
      now,
    );
    if (!best || KIND_RANK[a.kind] < KIND_RANK[best.kind]) { best = a; bestOrder = o; }
  }

  // A customer owed a reply still needs us even if their order is waiting elsewhere.
  if (best && needsUs(best)) return { action: best, timer, order: bestOrder };
  const enquiry = nextActionForEnquiry({ side, agingLevel: aging?.aging?.level ?? null });
  if (best && best.kind === 'waiting' && enquiry.kind !== 'follow') return { action: best, timer };
  return { action: enquiry, timer };
}

export interface InboxCue {
  needYou: number;
  overdue: number;
  dueSoon: number;
}

/** Banner counts. Cold rows (see `isColdRow`) are passed as `cold` and never counted. */
export function inboxCue(rows: Array<InboxRowAction & { cold?: boolean }>): InboxCue {
  let needYou = 0, overdue = 0, dueSoon = 0;
  for (const r of rows) {
    if (r.cold) continue;
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

/** Unlinked threads we never replied to go cold after this long (Arin, 2026-10-14). */
export const COLD_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Cold: an UNLINKED row nobody on our side ever replied to, whose latest message is
 * older than 14 days (spam, newsletters, dead leads). Sorted last, never counted.
 */
export function isColdRow(
  row: { kind: 'linked' | 'unlinked'; everReplied?: boolean; latestMessageAt: string | null },
  now: number = Date.now(),
): boolean {
  if (row.kind !== 'unlinked' || row.everReplied) return false;
  const t = row.latestMessageAt ? Date.parse(row.latestMessageAt) : NaN;
  return !Number.isNaN(t) && now - t > COLD_AFTER_MS;
}

/**
 * Inbox order (Arin, 2026-10-14 v2): chased first — the customer is waiting on us —
 * NEWEST wait first, so fresh messages are not buried under months-old ones. Then rows
 * waiting on them (longest first), then rows with no aging, then cold rows. Stable.
 */
export function sortChasedFirst<T>(
  rows: T[],
  waitOf: (row: T) => RowWait | null,
  isCold: (row: T) => boolean = () => false,
): T[] {
  const rank = (w: RowWait | null, cold: boolean) => (cold ? 3 : w == null ? 2 : w.side === 'us' ? 0 : 1);
  return rows
    .map((row, i) => {
      const w = waitOf(row);
      const cold = isCold(row);
      return { row, i, w, r: rank(w, cold) };
    })
    .sort((a, b) => {
      if (a.r !== b.r) return a.r - b.r;
      const as = a.w?.sinceMs ?? 0;
      const bs = b.w?.sinceMs ?? 0;
      const bySince = a.r === 0 ? as - bs : bs - as;
      return bySince || a.i - b.i;
    })
    .map((x) => x.row);
}

/**
 * The next-step bar's one primary (inbox-v11). Replies focus the composer; order
 * steps open the existing screen for that work. Waiting / none have no primary.
 */
export function conversationPrimary(action: NextAction): { label: string; target: string } | null {
  switch (action.kind) {
    case 'follow':
      return { label: 'Reply', target: 'composer' };
    case 'deposit':
      return { label: 'Request deposit', target: '/dashboard/finance' };
    case 'balance':
      return { label: 'Request balance', target: '/dashboard/finance' };
    case 'order':
      return { label: 'Create order', target: '/dashboard/finance' };
    default:
      return null;
  }
}

/**
 * `conversationPrimary` with the deciding order's invoice: Request deposit / Create
 * balance payment open that invoice's Collect payment card pre-filled
 * (InvoiceWorkspace ?invoice=&focus=collect&amount=deposit|full). Without an invoice
 * they fall back to the Finance page.
 */
export function rowPrimary(row: InboxRowAction): { label: string; target: string } | null {
  const def = conversationPrimary(row.action);
  if (!def) return null;
  const invoiceId = row.order?.invoice_id;
  if ((row.action.kind === 'deposit' || row.action.kind === 'balance') && invoiceId) {
    const amount = row.action.kind === 'deposit' ? 'deposit' : 'full';
    return {
      label: def.label,
      target: `/dashboard/finance?invoice=${encodeURIComponent(invoiceId)}&focus=collect&amount=${amount}`,
    };
  }
  return def;
}

/** Row chips show only non-reply steps; a reply owed is already the timer's job. */
export function showsRowChip(action: NextAction): boolean {
  return needsUs(action) && action.kind !== 'follow';
}

/* ───────── Lanes (inbox-v13): Customers / Enquiries counts ───────── */

type LaneAging = { bucket: InboxBucket; aging: AgingInfo | null };

/** The stalest us-side member of a row (customer waiting on us), or null. */
export function rowUsAging(conversationIds: string[], map: Map<string, LaneAging>): LaneAging | null {
  let worst: LaneAging | null = null;
  for (const id of conversationIds) {
    const e = map.get(id);
    if (e?.aging?.ball.side !== 'us') continue;
    if (!worst || e.aging.ball.sinceMs > worst.aging!.ball.sinceMs) worst = e;
  }
  return worst;
}

export interface LaneStats {
  count: number;
  overdue: number;
}

/**
 * Lane card figures. Cold rows never count. `ballWithUsOnly` (Enquiries lane): only rows
 * where the customer is waiting on us. Overdue = us-side past the bucket reply SLA.
 */
export function laneStats<
  R extends { conversationIds: string[]; kind: 'linked' | 'unlinked'; latestMessageAt: string | null; everReplied?: boolean },
>(rows: R[], map: Map<string, LaneAging>, opts: { ballWithUsOnly?: boolean } = {}, now: number = Date.now()): LaneStats {
  let count = 0;
  let overdue = 0;
  for (const r of rows) {
    if (isColdRow(r, now)) continue;
    const us = rowUsAging(r.conversationIds, map);
    if (opts.ballWithUsOnly && !us) continue;
    count += 1;
    if (us?.aging && us.aging.ball.sinceMs >= BUCKET_SLA[us.bucket].usOwesMs) overdue += 1;
  }
  return { count, overdue };
}

/* ───────── Row explanation (inbox-v13: one plain line under the name) ───────── */

const DAY_MS = 24 * 60 * 60 * 1000;
const days = (ms: number) => Math.max(0, Math.floor(ms / DAY_MS));

/**
 * One-line plain explanation of the next action for a row. Derived only from the
 * action + reply clock; never invents order facts.
 */
export function rowExplanation(row: InboxRowAction, ball: { side: 'us' | 'them'; sinceMs: number } | null): string {
  const a = row.action;
  switch (a.kind) {
    case 'follow':
      return ball ? `They wrote ${days(ball.sinceMs) === 0 ? 'today' : `${days(ball.sinceMs)}d ago`} and are waiting for our reply.` : 'Waiting for our reply.';
    case 'deposit':
      return 'Order agreed, no deposit yet. Send the deposit invoice (50% memorial + permit fee).';
    case 'balance':
      return 'Stone ready. Invoice the balance before fixing.';
    case 'order':
      return 'Quote accepted. Create the order and the deposit invoice.';
    case 'waiting':
      return ball ? `Waiting on them for ${days(ball.sinceMs)}d. Nothing to do until they reply.` : 'Waiting on them.';
    default:
      return a.reason || '';
  }
}
