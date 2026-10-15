/**
 * One pure function per lane (A.4). Each returns WorkItem | null — null means terminal or
 * nothing to do. `since`/`dueAt`/`urgency` are left as placeholders here (sla.ts's
 * withUrgency() stamps the real values); adapters only decide stage/verb/blockedBy/blocker
 * and where the "since" clock for THIS item starts.
 *
 * Source tables, per docs/work-model-map.md "Notes for Phase A": permit and proof each read
 * the richer, timestamp-bearing table (order_permits.permit_phase / order_proofs.state), not
 * orders.permit_status / orders.proof_status. Payment has no backing stage column at all —
 * fromReceivable() derives it from the same signals nextActionForOrder/receivables.ts read.
 */
import type { BlockedBy, Verb, WorkItem } from './types';
import { TERMINAL, translatePermitPhase, translateOrderProofState, translateOrderProofStatus, translateSalesStage, type Stage } from './stages';

// stages.ts also exports translateOrderPermitStatus / translateOrderProofStatus, for the OTHER
// vocabulary (orders.permit_status / orders.proof_status, map §2). These adapters don't read
// them — they prefer the richer order_permits/order_proofs tables, per the map's recommendation.

/** Same test as todayModel.ts's ballOnUs (duplicated, not imported: that file is React-adjacent
 * app code outside src/shared/work, and this lane intentionally stays dependency-free). */
function ballOnUs(lastInAt: string | null, lastOutAt: string | null): boolean {
  const i = lastInAt ? Date.parse(lastInAt) : NaN;
  if (Number.isNaN(i)) return false;
  const o = lastOutAt ? Date.parse(lastOutAt) : NaN;
  return Number.isNaN(o) || i > o;
}

const PLACEHOLDER = { dueAt: null, urgency: 'ok' } as const;

/* ───────── sales + cs (fromConversation) ───────── */

export interface SalesConversationInput {
  lane: 'sales';
  jobId: string;
  personId: string | null;
  conversationId: string | null;
  jobStage: string | null;
  jobExitReason: string | null;
  createdAt: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  name: string;
  orderId: string | null;
  orderRef: string | null;
  value: number | null;
  valueIsEstimate: boolean;
}

export interface CsConversationInput {
  lane: 'cs';
  orderId: string;
  personId: string | null;
  conversationId: string | null;
  name: string;
  orderRef: string | null;
  value: number | null;
  createdAt: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
}

function fromSalesConversation(input: SalesConversationInput): WorkItem | null {
  const stage = translateSalesStage(input.jobStage, input.jobExitReason);
  if (stage == null || TERMINAL.sales.includes(stage)) return null;

  let verb: Verb;
  let blockedBy: BlockedBy;
  let blocker: string;
  let since: string;

  if (stage === 'enquiry') {
    blockedBy = 'us';
    if (!input.lastOutboundAt) {
      verb = 'reply';
      blocker = 'New enquiry, no reply sent';
    } else {
      verb = 'quote';
      blocker = 'Replied, quote not sent yet';
    }
    since = input.lastInboundAt ?? input.createdAt;
  } else {
    // stage === 'quoted'
    verb = 'chase';
    blockedBy = 'them';
    blocker = 'Quote sent, waiting on the customer';
    since = input.lastOutboundAt ?? input.createdAt;
  }

  return {
    id: `sales:${input.orderId ?? input.personId ?? input.jobId}`,
    lane: 'sales', stage, verb, blockedBy, since, ...PLACEHOLDER,
    value: input.value, valueIsEstimate: input.valueIsEstimate,
    orderId: input.orderId, personId: input.personId, conversationId: input.conversationId,
    title: input.name, ref: input.orderRef, blocker, draftReady: false, ownerId: null,
  };
}

/** Decision 5: CS's only verb today is 'reply' (24h SLA) — the family-waiting-on-us branch
 * of todayRules.ts's csItems(). Fixing-soon / proof-ready branches aren't represented as
 * WorkItems yet (no Verb exists for them in A.1's union); out of scope for Phase A. */
function fromCsConversation(input: CsConversationInput): WorkItem | null {
  if (!ballOnUs(input.lastInboundAt, input.lastOutboundAt)) return null;
  return {
    id: `cs:${input.orderId}`,
    lane: 'cs', stage: 'family_waiting', verb: 'reply', blockedBy: 'us',
    since: input.lastInboundAt ?? input.createdAt, ...PLACEHOLDER,
    value: input.value, valueIsEstimate: false,
    orderId: input.orderId, personId: input.personId, conversationId: input.conversationId,
    title: input.name, ref: input.orderRef, blocker: 'Family waiting on us', draftReady: false, ownerId: null,
  };
}

export function fromConversation(input: SalesConversationInput | CsConversationInput): WorkItem | null {
  return input.lane === 'sales' ? fromSalesConversation(input) : fromCsConversation(input);
}

/* ───────── permit (fromOrderPermit) ───────── */

export interface OrderPermitInput {
  orderId: string;
  orderExitReason: string | null; // the linked job's exit_reason — null if the order is still open
  permitPhase: string | null;     // order_permits.permit_phase
  sentAt: string | null;
  submittedAt: string | null;
  stageEnteredAt: string | null;
  createdAt: string;
  name: string;
  ref: string | null;
  value: number | null;
}

export function fromOrderPermit(input: OrderPermitInput): WorkItem | null {
  if (input.orderExitReason) return null;
  const stage = translatePermitPhase(input.permitPhase);
  if (stage == null || TERMINAL.permit.includes(stage)) return null;

  let verb: Verb;
  let blockedBy: BlockedBy;
  let blocker: string;
  let since: string;

  switch (stage) {
    case 'not_started':
      verb = 'send_permit'; blockedBy = 'us'; blocker = 'Permit form not sent yet';
      since = input.stageEnteredAt ?? input.createdAt;
      break;
    case 'form_sent':
    case 'with_family':
      verb = 'chase'; blockedBy = 'them'; blocker = 'Family has the permit form';
      since = input.sentAt ?? input.stageEnteredAt ?? input.createdAt;
      break;
    case 'submitted':
      verb = 'chase_council'; blockedBy = 'them'; blocker = 'Council has not responded';
      since = input.submittedAt ?? input.stageEnteredAt ?? input.createdAt;
      break;
    case 'rejected':
      verb = 'fix_permit'; blockedBy = 'us'; blocker = 'Permit application rejected';
      since = input.stageEnteredAt ?? input.createdAt;
      break;
    default:
      return null;
  }

  return {
    id: `permit:${input.orderId}`,
    lane: 'permit', stage, verb, blockedBy, since, ...PLACEHOLDER,
    value: input.value, valueIsEstimate: false,
    orderId: input.orderId, personId: null, conversationId: null,
    title: input.name, ref: input.ref, blocker, draftReady: false, ownerId: null,
  };
}

/* ───────── proof (fromOrderProof) ───────── */

export interface OrderProofInput {
  orderId: string;
  orderExitReason: string | null;
  state: string | null; // order_proofs.state (preferred source, map "Notes for Phase A")
  /** orders.proof_status — fallback used only when `state` is null (e.g. the Hub's brand data
   * doesn't load order_proofs; no new query is added for it in Phase B). */
  proofStatus?: string | null;
  sentAt: string | null;
  changesRequestedAt: string | null;
  createdAt: string;
  name: string;
  ref: string | null;
  value: number | null;
}

export function fromOrderProof(input: OrderProofInput): WorkItem | null {
  if (input.orderExitReason) return null;
  const stage = input.state != null
    ? translateOrderProofState(input.state)
    : translateOrderProofStatus(input.proofStatus ?? null);
  if (stage == null || TERMINAL.proof.includes(stage)) return null;

  let verb: Verb;
  let blockedBy: BlockedBy;
  let blocker: string;
  let since: string;

  switch (stage) {
    case 'not_started':
    case 'drafting':
      verb = 'send_proof'; blockedBy = 'us'; blocker = 'Proof not sent yet';
      since = input.createdAt;
      break;
    case 'sent':
      verb = 'chase_proof'; blockedBy = 'them'; blocker = 'Waiting on the family to approve the proof';
      since = input.sentAt ?? input.createdAt;
      break;
    case 'changes_requested':
      verb = 'revise_proof'; blockedBy = 'us'; blocker = 'Family asked for changes';
      since = input.changesRequestedAt ?? input.createdAt;
      break;
    default:
      return null;
  }

  return {
    id: `proof:${input.orderId}`,
    lane: 'proof', stage, verb, blockedBy, since, ...PLACEHOLDER,
    value: input.value, valueIsEstimate: false,
    orderId: input.orderId, personId: null, conversationId: null,
    title: input.name, ref: input.ref, blocker, draftReady: false, ownerId: null,
  };
}

/* ───────── payment (fromReceivable) ───────── */

export interface ReceivableOrderInput {
  kind: 'order';
  orderId: string;
  isOpen: boolean;                 // isReceivableOrder(): live, non-test, non-exited order
  depositPaid: boolean;            // matched money in, deposit_date or job.paid_at
  /** deposit_date is set but no amount is recorded (receivables.ts 'Record payment' branch). */
  depositUnrecorded: boolean;
  depositInvoiced: boolean;        // a live (non-void) invoice exists while no deposit is in
  balanceDue: boolean;             // fixing ≤ 30d, or stone in stock with no fixing date
  balanceRequested: boolean;       // a live invoice is out for the balance
  remainingPence: number;          // canonical owed figure; becomes WorkItem.value (pounds)
  since: string;
  name: string;
  ref: string | null;
}

/** No canonical stage fits an unmatched bank line (map §2: "an exception flag layered on top
 * of the stage model, not a stage itself"). 'deposit_due' is used only as a type-safe
 * placeholder — it does not mean this row is actually at the deposit stage. */
export interface UnmatchedPaymentInput {
  kind: 'unmatched_payment';
  paymentId: string;
  amountPounds: number;
  receivedAt: string | null;
  reference: string | null;
  source: string | null;
}

export type ReceivableInput = ReceivableOrderInput | UnmatchedPaymentInput;

export function fromReceivable(input: ReceivableInput, now: Date): WorkItem | null {
  if (input.kind === 'unmatched_payment') {
    return {
      id: `payment:unmatched:${input.paymentId}`,
      lane: 'payment', stage: 'deposit_due', verb: 'reconcile', blockedBy: 'us',
      since: input.receivedAt ?? now.toISOString(), ...PLACEHOLDER,
      value: input.amountPounds, valueIsEstimate: false,
      orderId: null, personId: null, conversationId: null,
      title: input.reference || 'Unmatched payment', ref: null,
      blocker: `${input.source ?? 'Bank'} payment not linked to an order`, draftReady: false, ownerId: null,
    };
  }

  if (!input.isOpen || input.remainingPence <= 0) return null;

  let stage: Stage;
  let verb: Verb;
  let blockedBy: BlockedBy;
  let blocker: string;

  if (input.depositUnrecorded) {
    stage = 'deposit_paid'; verb = 'record_payment'; blockedBy = 'us'; blocker = 'Deposit date set, no amount recorded';
  } else if (!input.depositPaid) {
    if (!input.depositInvoiced) {
      stage = 'not_invoiced'; verb = 'request_deposit'; blockedBy = 'us'; blocker = 'No deposit and no live invoice';
    } else {
      stage = 'deposit_due'; verb = 'request_deposit'; blockedBy = 'them'; blocker = 'Deposit invoiced, not yet paid';
    }
  } else if (input.balanceDue) {
    if (input.balanceRequested) {
      stage = 'balance_due'; verb = 'request_balance'; blockedBy = 'them'; blocker = 'Balance invoiced, not yet paid';
    } else {
      stage = 'balance_due'; verb = 'request_balance'; blockedBy = 'us'; blocker = 'Balance due, not requested yet';
    }
  } else {
    return null; // deposit_paid, balance not due yet: resting state, nothing to do
  }

  return {
    id: `payment:${input.orderId}`,
    lane: 'payment', stage, verb, blockedBy, since: input.since, ...PLACEHOLDER,
    value: Math.round(input.remainingPence) / 100, valueIsEstimate: false,
    orderId: input.orderId, personId: null, conversationId: null,
    title: input.name, ref: input.ref, blocker, draftReady: false, ownerId: null,
  };
}
