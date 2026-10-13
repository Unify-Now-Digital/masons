/**
 * Next-action rules (Mason UI phases 2–4; uiux-proposals "Next-step actions",
 * wayfinding-v10, audit #8). One pure function, unit-tested, shared by the Orders
 * list and the Inbox list. It only reads fields that exist today.
 *
 * Rule order = earliest blocking stage wins:
 *   enquiry: Follow up enquiry (our turn) · Create order/invoice (quote accepted) · Waiting
 *   order:   Request deposit → Send permit → Draft a 2D proof → Create balance payment · Waiting
 */

export type NextActionKind =
  | 'follow'   // Follow up enquiry
  | 'order'    // Create order/invoice
  | 'permit'   // Send permit
  | 'deposit'  // Request deposit (olive payment colour)
  | 'balance'  // Create balance payment
  | 'proof'    // Draft a 2D proof
  | 'waiting'  // someone else owes the next move
  | 'none';    // nothing to do (complete / exited / no signal)

export type NextActionTone = 'red' | 'amber' | 'neutral';

export type WaitingOn = 'customer' | 'cemetery' | 'grave owner';

export interface NextAction {
  kind: NextActionKind;
  /** Button / chip text. */
  label: string;
  /** Short "why" for the row or the next-step box. */
  reason: string;
  /** Colour of the reason line only: red = blocked/overdue on us, amber = due soon. */
  tone: NextActionTone;
  waitingOn?: WaitingOn;
}

export const NEXT_ACTION_LABEL: Record<Exclude<NextActionKind, 'waiting' | 'none'>, string> = {
  follow: 'Follow up enquiry',
  order: 'Create order/invoice',
  permit: 'Send permit',
  deposit: 'Request deposit',
  balance: 'Create balance payment',
  proof: 'Draft a 2D proof',
};

/** True for kinds where we (not someone else) owe the next move. */
export function needsUs(a: NextAction): boolean {
  return a.kind !== 'waiting' && a.kind !== 'none';
}

const act = (kind: Exclude<NextActionKind, 'waiting' | 'none'>, reason: string, tone: NextActionTone = 'neutral'): NextAction => ({
  kind, label: NEXT_ACTION_LABEL[kind], reason, tone,
});
const waiting = (on: WaitingOn, reason: string): NextAction => ({
  kind: 'waiting', label: `Waiting · ${on}`, reason, tone: 'neutral', waitingOn: on,
});
const NONE: NextAction = { kind: 'none', label: '', reason: '', tone: 'neutral' };

/* ───────── Orders ───────── */

export interface OrderActionInput {
  /** jobs.stage when the order is linked to a pipeline job. */
  jobStage?: string | null;
  jobExitReason?: string | null;
  /** jobs.paid_at — deposit received. */
  jobPaidAt?: string | null;
  /** orders.deposit_date — deposit received (legacy/manual). */
  depositDate?: string | null;
  /** orders.second_payment_date — balance received. */
  secondPaymentDate?: string | null;
  stoneStatus?: string | null;   // 'NA' | 'Ordered' | 'In Stock'
  permitStatus?: string | null;  // 'not_started' | 'form_sent' | 'customer_completed' | 'pending' | 'approved'
  proofStatus?: string | null;   // 'NA' | 'Not_Received' | 'Received' | 'Sent' | 'Revision' | 'Approved' | 'Lettered' | 'In_Progress'
  installationDate?: string | null;
}

const BALANCE_WINDOW_DAYS = 21;
const DAY_MS = 86_400_000;

const isBlank = (v?: string | null) => !v || !String(v).trim();

export function nextActionForOrder(o: OrderActionInput, now: Date = new Date()): NextAction {
  if (o.jobExitReason) return NONE;
  if (o.jobStage === 'complete') return NONE;

  // 1. Deposit
  const depositPaid = !isBlank(o.jobPaidAt) || !isBlank(o.depositDate);
  if (!depositPaid) return act('deposit', 'No deposit recorded yet', 'red');

  // 2. Permit
  switch (o.permitStatus) {
    case 'not_started':
    case undefined:
    case null:
      return act('permit', 'Blocked on us: permit not started', 'red');
    case 'customer_completed':
      return act('permit', 'Signed permit form received', 'red');
    case 'form_sent':
      return waiting('grave owner', 'Permit form with grave owner');
    case 'pending':
      return waiting('cemetery', 'Permit pending with cemetery');
    default:
      break; // approved
  }

  // 3. Proof
  switch (o.proofStatus) {
    case 'Received':
      return act('proof', 'Inscription received, no proof yet');
    case 'Revision':
      return act('proof', 'Family asked for proof changes', 'amber');
    case 'In_Progress':
      return act('proof', 'Proof in progress');
    case 'Not_Received':
      return waiting('customer', 'Waiting for inscription text');
    case 'Sent':
      return waiting('customer', 'Proof sent for approval');
    default:
      break; // Approved, Lettered, NA
  }

  // 4. Balance
  const proofDone = o.proofStatus === 'Approved' || o.proofStatus === 'Lettered' || o.proofStatus === 'NA';
  const ready = o.stoneStatus === 'In Stock' && o.permitStatus === 'approved' && proofDone;
  if (ready && isBlank(o.secondPaymentDate) && o.installationDate) {
    const install = Date.parse(o.installationDate);
    if (!Number.isNaN(install)) {
      const days = Math.ceil((install - now.getTime()) / DAY_MS);
      if (days <= BALANCE_WINDOW_DAYS) {
        return act('balance', days < 0 ? 'Installed, balance unpaid' : `Install in ${days}d, balance unpaid`, days <= 7 ? 'red' : 'amber');
      }
    }
  }
  return NONE;
}

/* ───────── Enquiries (Inbox rows without an open order) ───────── */

export interface EnquiryActionInput {
  /** Who owes the next reply (deriveBallInCourt). null = unknown. */
  side: 'us' | 'them' | null;
  /** jobs.stage if known. */
  jobStage?: string | null;
  /** Customer accepted a quote. NOT stored today (data gap) — leave undefined. */
  quoteAccepted?: boolean;
  /** Aging level of our side (computeAging): drives the reason colour. */
  agingLevel?: 'fresh' | 'amber' | 'red' | null;
}

export function nextActionForEnquiry(e: EnquiryActionInput): NextAction {
  if (e.jobStage === 'quoted' && e.quoteAccepted) return act('order', 'Customer accepted the quote', 'amber');
  if (e.side === 'us') {
    const tone: NextActionTone = e.agingLevel === 'red' ? 'red' : e.agingLevel === 'amber' ? 'amber' : 'neutral';
    return act('follow', 'Customer is waiting for us', tone);
  }
  if (e.side === 'them') return waiting('customer', 'Waiting for the customer');
  return NONE;
}

/* ───────── Reply timer text (audit #5: words, colour only reinforces) ───────── */

export interface TimerText {
  text: string;
  tone: 'over' | 'soon' | 'neutral';
}

export function formatDuration(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * Our turn: "Overdue · 2d" past the SLA, "Due in 2h" before it.
 * Their turn: "Waiting · 3d".
 */
export function replyTimerText(side: 'us' | 'them', sinceMs: number, slaMs: number): TimerText {
  if (side === 'them') return { text: `Waiting · ${formatDuration(sinceMs)}`, tone: 'neutral' };
  if (sinceMs >= slaMs) return { text: `Overdue · ${formatDuration(sinceMs - slaMs)}`, tone: 'over' };
  const left = slaMs - sinceMs;
  return { text: `Due in ${formatDuration(left)}`, tone: left <= slaMs / 2 ? 'soon' : 'neutral' };
}

/* ───────── New job duplicate check (pure; wiring held — see PR) ───────── */

export interface JobLike {
  id: string;
  stage: string | null;
  exit_reason?: string | null;
  label?: string | null;
}

/** Open (not exited, not complete) jobs the person already has. */
export function findOpenDuplicateJobs(jobs: JobLike[]): JobLike[] {
  return jobs.filter((j) => !j.exit_reason && j.stage !== 'complete');
}
