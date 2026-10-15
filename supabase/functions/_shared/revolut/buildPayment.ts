import { matchRevolutPayment, type RevolutMatchCandidate, type RevolutMatchOrder } from './match.ts';
import { counterpartyLabel, incomingLeg, type RevolutTransaction } from './transaction.ts';

export type RevolutPaymentStatus = 'matched' | 'unmatched' | 'dismissed';

export interface RevolutPaymentInsert {
  organization_id: string;
  user_id: string | null;
  order_id: string | null;
  source: 'revolut';
  external_id: string;
  amount: number;
  currency: string;
  payment_type: null;
  reference: string | null;
  counterparty_name: string | null;
  provider_state: string;
  account_id: string | null;
  leg_id: string | null;
  revolut_type: string | null;
  match_reason: string;
  match_candidates: RevolutMatchCandidate[] | null;
  matched_at: string | null;
  matched_by: string | null;
  status: RevolutPaymentStatus;
  received_at: string;
}

const TERMINAL = new Set(['declined', 'failed', 'reverted']);

/**
 * Row for order_payments, or null when this transaction is not money in
 * (outgoing, fee, internal transfer, or no positive leg).
 * Completed + one high-confidence match is the only path that sets order_id.
 */
export function buildRevolutPaymentInsert(args: {
  organizationId: string;
  userId: string | null;
  txn: RevolutTransaction;
  orders: RevolutMatchOrder[];
  counterpartyName?: string | null;
  nowIso?: string;
}): RevolutPaymentInsert | null {
  const leg = incomingLeg(args.txn);
  if (!leg || !args.txn.id) return null;
  const state = (args.txn.state ?? 'pending').toLowerCase();
  const received = args.txn.completed_at || args.txn.created_at;
  if (!received) return null;
  const name = counterpartyLabel(leg.description, args.counterpartyName);
  const terminal = TERMINAL.has(state);
  const match = terminal
    ? { candidates: [], autoMatchOrderId: null, matchReason: `Revolut ${state}` }
    : matchRevolutPayment(
        { amountPounds: leg.amountPounds, reference: args.txn.reference ?? null, counterpartyName: name },
        args.orders,
      );
  const auto = state === 'completed' && match.autoMatchOrderId ? match.autoMatchOrderId : null;
  const now = args.nowIso ?? new Date().toISOString();
  return {
    organization_id: args.organizationId,
    user_id: args.userId,
    order_id: auto,
    source: 'revolut',
    external_id: args.txn.id,
    amount: leg.amountPounds,
    currency: leg.currency,
    payment_type: null,
    reference: args.txn.reference?.trim() || null,
    counterparty_name: name,
    provider_state: state,
    account_id: leg.accountId,
    leg_id: leg.legId,
    revolut_type: args.txn.type ?? null,
    match_reason: terminal ? `Revolut ${state}` : match.matchReason,
    match_candidates: match.candidates.length ? match.candidates : null,
    matched_at: auto ? now : null,
    matched_by: auto || terminal ? 'auto' : null,
    status: terminal ? 'dismissed' : auto ? 'matched' : 'unmatched',
    received_at: received,
  };
}

/** What a repeat delivery may change. A person's match is left alone. */
export function revolutResyncPatch(
  existing: { status: string | null; matched_by: string | null },
  next: RevolutPaymentInsert,
): Partial<RevolutPaymentInsert> | null {
  const human = existing.status === 'matched' && existing.matched_by && existing.matched_by !== 'auto';
  if (human && next.status !== 'dismissed') {
    return { provider_state: next.provider_state };
  }
  if (next.status === 'dismissed') {
    return {
      provider_state: next.provider_state,
      status: 'dismissed',
      matched_by: existing.matched_by || 'auto',
      match_reason: next.match_reason,
    };
  }
  if (existing.status === 'dismissed' || existing.status === 'matched') {
    return { provider_state: next.provider_state };
  }
  return {
    provider_state: next.provider_state,
    amount: next.amount,
    currency: next.currency,
    reference: next.reference,
    counterparty_name: next.counterparty_name,
    account_id: next.account_id,
    leg_id: next.leg_id,
    revolut_type: next.revolut_type,
    match_reason: next.match_reason,
    match_candidates: next.match_candidates,
    order_id: next.order_id,
    matched_at: next.matched_at,
    matched_by: next.matched_by,
    status: next.status,
    received_at: next.received_at,
  };
}
