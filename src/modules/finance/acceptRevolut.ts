/**
 * Accept / Ignore decisions for a Revolut row already stored on order_payments.
 * Accept updates that row (source revolut, same transaction id). It does not insert a second payment.
 */
import type { OrderPaymentRow } from '@/modules/today/brandData.types';

const TERMINAL = new Set(['declined', 'failed', 'reverted']);

export type RevolutDecisionKind = 'missing' | 'not_revolut' | 'no_transaction' | 'already' | 'conflict' | 'update';

export interface RevolutMatchPatch {
  order_id: string;
  source: 'revolut';
  status: 'matched';
  matched_at: string;
  matched_by: string;
  payment_type: 'deposit' | 'final';
  match_reason: string;
}

export interface RevolutIgnorePatch {
  order_id: null;
  source: 'revolut';
  status: 'dismissed';
  matched_at: string;
  matched_by: string;
  match_reason: string;
}

export type RevolutDecision =
  | { kind: Exclude<RevolutDecisionKind, 'update'> }
  | { kind: 'update'; patch: RevolutMatchPatch | RevolutIgnorePatch };

export function isOpenRevolutItem(row: Pick<OrderPaymentRow, 'source' | 'status' | 'provider_state'>): boolean {
  if ((row.source ?? '').toLowerCase() !== 'revolut') return false;
  if (row.status !== 'unmatched') return false;
  return !TERMINAL.has((row.provider_state ?? '').toLowerCase());
}

/** Pending money has not cleared. Empty state is a legacy row and can be accepted. */
export function revolutAcceptable(row: Pick<OrderPaymentRow, 'provider_state'>): boolean {
  const state = (row.provider_state ?? '').toLowerCase();
  return state === '' || state === 'completed';
}

export function paidSoFar(
  orderId: string,
  payments: Pick<OrderPaymentRow, 'order_id' | 'status' | 'amount'>[],
): number {
  const total = payments
    .filter((row) => row.order_id === orderId && row.status === 'matched')
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  return Math.round(total * 100) / 100;
}

function gate(row: OrderPaymentRow | null | undefined): RevolutDecision | null {
  if (!row) return { kind: 'missing' };
  if ((row.source ?? '').toLowerCase() !== 'revolut') return { kind: 'not_revolut' };
  if (!row.external_id) return { kind: 'no_transaction' };
  return null;
}

export function acceptRevolutDecision(
  row: OrderPaymentRow | null | undefined,
  orderId: string,
  paid: number,
  actor: string,
  nowIso: string,
): RevolutDecision {
  const blocked = gate(row);
  if (blocked || !row) return blocked ?? { kind: 'missing' };
  if (row.status === 'matched' && row.order_id === orderId) return { kind: 'already' };
  if (row.status !== 'unmatched') return { kind: 'conflict' };
  const patch: RevolutMatchPatch = {
    order_id: orderId,
    source: 'revolut',
    status: 'matched',
    matched_at: nowIso,
    matched_by: actor,
    payment_type: paid <= 0 ? 'deposit' : 'final',
    match_reason: 'Accepted in Reconcile',
  };
  return { kind: 'update', patch };
}

export function ignoreRevolutDecision(
  row: OrderPaymentRow | null | undefined,
  actor: string,
  nowIso: string,
): RevolutDecision {
  const blocked = gate(row);
  if (blocked || !row) return blocked ?? { kind: 'missing' };
  if (row.status === 'dismissed') return { kind: 'already' };
  if (row.status !== 'unmatched') return { kind: 'conflict' };
  const patch: RevolutIgnorePatch = {
    order_id: null,
    source: 'revolut',
    status: 'dismissed',
    matched_at: nowIso,
    matched_by: actor,
    match_reason: 'Ignored in Reconcile',
  };
  return { kind: 'update', patch };
}

export function revolutDecisionMessage(kind: RevolutDecisionKind, action: 'accept' | 'ignore'): string {
  if (kind === 'update') return action === 'accept' ? 'Matched to the order' : 'Ignored';
  if (kind === 'already') return action === 'accept' ? 'Already matched to this order' : 'Already ignored';
  if (kind === 'conflict') return 'This payment was already matched';
  if (kind === 'missing') return 'Payment not found';
  if (kind === 'not_revolut') return 'Only a Revolut payment can be accepted here';
  return 'This row has no Revolut transaction id';
}
