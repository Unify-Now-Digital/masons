/**
 * One work model: every lane (sales, CS, permits, proofs, payments) produces the same
 * WorkItem shape. See docs/work-model-map.md for the approved mapping this file follows.
 * No React imports here (useWorkItems.ts is the one exception, per the spec).
 */
import type { Stage } from './stages';

/** CS is its own lane (Decision 5, docs/work-model-map.md) — not merged into sales. */
export type Lane = 'sales' | 'cs' | 'permit' | 'proof' | 'payment';

export type BlockedBy = 'us' | 'them' | 'none';

/** Drives bar colour. */
export type Urgency = 'overdue' | 'due' | 'waiting' | 'ok';

export type Verb =
  | 'reply' | 'quote' | 'chase'                      // sales (+ 'reply' for cs, Decision 5)
  | 'send_permit' | 'chase_council' | 'fix_permit'   // permit
  | 'send_proof' | 'chase_proof' | 'revise_proof'    // proof
  | 'request_deposit' | 'request_balance' | 'record_payment' | 'reconcile'; // payment

export interface WorkItem {
  id: string;               // `${lane}:${orderId ?? personId}`
  lane: Lane;
  stage: Stage;
  verb: Verb;               // the ONE next action
  blockedBy: BlockedBy;
  since: string;            // ISO date the current stage started
  dueAt: string | null;     // since + SLA (computed in sla.ts)
  urgency: Urgency;         // computed in sla.ts
  value: number | null;     // GBP; null = unknown
  valueIsEstimate: boolean;
  orderId: string | null;
  personId: string | null;
  conversationId: string | null;
  title: string;            // person name
  ref: string | null;       // getOrderDisplayId(order)
  blocker: string;          // ≤ 60 chars, plain English: "Council silent 12 days"
  draftReady: boolean;      // an AI draft exists for `verb`
  ownerId: string | null;
}

/** UI label per lane (UI says "Payments"; replySla.ts keeps the 'Finance' key — Decision 6). */
export const LANE_LABEL: Record<Lane, string> = {
  sales: 'Sales',
  cs: 'CS',
  permit: 'Permits',
  proof: 'Proofs',
  payment: 'Payments',
};

/**
 * Lane → replySla.ts key, for lanes whose reply timer is a real reply SLA.
 * sales/cs reply off REPLY_SLA_HOURS.Sales/.CS; payment keeps the 'Finance' key (Decision 6).
 * permit maps to 'Permits' for completeness, though no permit verb is currently 'reply'.
 * proof has NO entry: replySla.ts has no 'Proof' key, and the proof lane's verbs ('send_proof',
 * 'chase_proof', 'revise_proof') are never 'reply' — proof timers come only from sla.ts's
 * stage SLA table (B.1), never from replySla.ts. See sla.ts.
 */
export const LANE_SLA_KEY: Partial<Record<Lane, 'Sales' | 'CS' | 'Permits' | 'Finance'>> = {
  sales: 'Sales',
  cs: 'CS',
  permit: 'Permits',
  payment: 'Finance',
};
