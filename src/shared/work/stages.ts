/**
 * Canonical stages per lane, and translation from today's DB values (docs/work-model-map.md §2).
 * Decision 2 (binding): sales terminal = won + abandoned. There is no 'lost' stage — dead jobs
 * close as 'abandoned' (client-derived; migration 20261014203000 to make it a stored
 * jobs.exit_reason value is written but NOT applied — see docs/work-model-map.md Gaps §5).
 */
import type { Lane } from './types';

export const STAGES = {
  sales: ['enquiry', 'quoted', 'won', 'abandoned'],
  // No stored stage column for CS (map §1): derived from todayRules.ts's csItems() branching.
  // 'family_waiting' is the only stage with a WorkItem verb today (Decision 5: cs verb = 'reply').
  cs: ['nothing_due', 'family_waiting', 'fixing_soon', 'proof_ready'],
  permit: ['not_started', 'form_sent', 'with_family', 'submitted', 'approved', 'rejected'],
  proof: ['not_started', 'drafting', 'sent', 'changes_requested', 'approved'],
  payment: ['not_invoiced', 'deposit_due', 'deposit_paid', 'balance_due', 'paid'],
} as const satisfies Record<Lane, readonly string[]>;

export type Stage = (typeof STAGES)[Lane][number];

/** Terminal stages: no WorkItem should be produced once a lane's item sits here.
 * cs has none — a CS order stays open (ongoing post-paid work) until it exits the pipeline
 * entirely, which this lane's stage set doesn't model. */
export const TERMINAL: Record<Lane, Stage[]> = {
  sales: ['won', 'abandoned'],
  cs: [],
  permit: ['approved'],
  proof: ['approved'],
  payment: ['paid'],
};

/**
 * jobs.stage / jobs.exit_reason → canonical sales stage.
 * All of lost/closed/dormant/cancelled (and the not-yet-legal 'abandoned') → 'abandoned'
 * (Decision 2). 'on_hold' is a pause, not a close: the map calls it unmapped (no canonical
 * 5th sales stage exists for it), so it returns null here — callers keep treating the job by
 * its jobStage in that case. Post-paid jobStage values (confirmed/in_production/fixed/complete)
 * are terminal for the SALES lane (handed to CS) → 'won'.
 */
export function translateSalesStage(jobStage: string | null, jobExitReason: string | null): Stage | null {
  if (jobExitReason) {
    if (jobExitReason === 'on_hold') return null;
    if (['lost', 'closed', 'dormant', 'cancelled', 'abandoned'].includes(jobExitReason)) return 'abandoned';
    return null;
  }
  switch (jobStage) {
    case 'enquired': return 'enquiry';
    case 'quoted': return 'quoted';
    case 'invoiced':
    case 'confirmed':
    case 'in_production':
    case 'fixed':
    case 'complete':
      return 'won';
    default: return null;
  }
}

/**
 * orders.permit_status → canonical permit stage (map §2). 'customer_completed' is flagged in
 * the map as a gap between 'with_family' and 'submitted' with no canonical slot — returns null
 * rather than guess. No live value maps to 'rejected' today (map §2/§5).
 */
export function translateOrderPermitStatus(value: string | null): Stage | null {
  switch (value) {
    case 'not_started': return 'not_started';
    case 'form_sent': return 'form_sent';
    case 'pending': return 'submitted';
    case 'approved': return 'approved';
    default: return null; // incl. 'customer_completed' (gap, map §2) and unrecognised values
  }
}

/**
 * order_permits.permit_phase → canonical permit stage (map §2). Different vocabulary from
 * orders.permit_status, same 5-stage shape. This is the adapter's chosen source (richer,
 * timestamp-bearing table — map "Notes for Phase A").
 *
 * 'returned_incomplete' is NOT a legal live value today — migration 20261014120000 would add
 * it but is explicitly marked "NOT APPLIED" (map Gaps §5). No live row can carry it yet; it's
 * mapped here only so 'rejected' (which otherwise has zero backing data, map §2) starts working
 * the moment that migration lands, with no further code change.
 */
export function translatePermitPhase(value: string | null): Stage | null {
  switch (value) {
    case 'form_needed': return 'not_started';
    case 'with_customer': return 'with_family';
    case 'completing': return 'with_family';
    case 'submitted': return 'submitted';
    case 'approved': return 'approved';
    case 'returned_incomplete': return 'rejected';
    default: return null;
  }
}

/**
 * orders.proof_status → canonical proof stage (map §2). 'NA' (no proof needed) and 'Received'
 * (ambiguous: inscription received vs proof returned) are flagged "don't guess" in the map —
 * both return null. 'Lettered' is a post-approval production step, out of the proof lane.
 */
export function translateOrderProofStatus(value: string | null): Stage | null {
  switch (value) {
    case 'Not_Received': return 'not_started';
    case 'In_Progress': return 'drafting'; // legacy value, still valid on rows
    case 'Sent': return 'sent';
    case 'Revision': return 'changes_requested';
    case 'Approved': return 'approved';
    default: return null; // incl. 'NA', 'Received', 'Lettered'
  }
}

/**
 * order_proofs.state → canonical proof stage (map §2). This is the adapter's chosen source
 * (richer, timestamp-bearing table). 'failed' is a technical error, not a workflow stage.
 */
export function translateOrderProofState(value: string | null): Stage | null {
  switch (value) {
    case 'not_started': return 'not_started';
    case 'generating': return 'drafting';
    case 'draft': return 'drafting';
    case 'sent': return 'sent';
    case 'changes_requested': return 'changes_requested';
    case 'approved': return 'approved';
    default: return null; // incl. 'failed'
  }
}

/**
 * Payment has NO backing column for its canonical stage at all (map §2/§5): it's derived from
 * deposit_date / stone_status / installation_date / invoice+payment amounts, two different ways
 * in receivables.ts vs invoiceRemaining.ts. fromReceivable() in adapters.ts computes it directly
 * rather than translating a single value — there is nothing here to translate.
 */
