/**
 * Suggest an order for a Revolut receipt.
 * Auto-apply only when there is exactly one high-confidence candidate:
 *   1. the payment reference contains that order number as its own number (100+), or
 *   2. the living customer's surname and the amount (to the penny) both match.
 * Name-only, amount-only, and the deceased's surname are suggestions. They stay unmatched
 * so Reconcile can accept them. A weak match never sets the order paid.
 */

export type RevolutConfidence = 'high' | 'medium' | 'low';

export interface RevolutMatchOrder {
  id: string;
  orderNumber: number | null;
  /** Living customer (orders.person_name). */
  payerName: string | null;
  /** Deceased (orders.customer_name). Never an automatic match on its own. */
  deceasedName?: string | null;
  /** Pounds still owed. */
  balanceDue: number;
}

export interface RevolutMatchInput {
  amountPounds: number;
  reference: string | null;
  counterpartyName: string | null;
}

export interface RevolutMatchCandidate {
  order_id: string;
  order_ref: string;
  customer_name: string;
  expected_amount: number;
  confidence: RevolutConfidence;
  reason: string;
}

export interface RevolutMatchResult {
  candidates: RevolutMatchCandidate[];
  autoMatchOrderId: string | null;
  matchReason: string;
}

const AMOUNT_TOLERANCE = 0.01;
const MIN_ORDER_NUMBER = 100;
const MIN_SURNAME = 3;

function normalise(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function surname(name: string | null | undefined): string {
  const parts = normalise(name).split(' ').filter((part) => /[a-z]/.test(part));
  return parts.length ? parts[parts.length - 1] : '';
}

function wordIn(haystack: string, word: string): boolean {
  if (word.length < MIN_SURNAME) return false;
  const text = normalise(haystack);
  if (!text) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(text);
}

/** Order number as its own token. 272 matches "272" and "ORD-000272", not "1272". */
export function referenceHasOrderNumber(reference: string | null | undefined, orderNumber: number | null): boolean {
  if (orderNumber == null || orderNumber < MIN_ORDER_NUMBER) return false;
  const text = reference ?? '';
  if (!text) return false;
  const n = String(orderNumber);
  return new RegExp(`(^|[^0-9])0*${n}([^0-9]|$)`).test(text);
}

function amountsMatch(paid: number, expected: number): boolean {
  return expected > 0 && Math.abs(paid - expected) < AMOUNT_TOLERANCE;
}

const RANK: Record<RevolutConfidence, number> = { high: 0, medium: 1, low: 2 };

export function matchRevolutPayment(input: RevolutMatchInput, orders: RevolutMatchOrder[]): RevolutMatchResult {
  const candidates: RevolutMatchCandidate[] = [];
  const reference = input.reference ?? '';
  const counterparty = input.counterpartyName ?? '';

  for (const order of orders) {
    const orderRef = order.orderNumber != null ? String(order.orderNumber) : '';
    const displayName = (order.payerName ?? order.deceasedName ?? '').trim();
    const expected = Number.isFinite(order.balanceDue) ? order.balanceDue : 0;
    const refHit = referenceHasOrderNumber(reference, order.orderNumber);
    const payer = surname(order.payerName);
    const deceased = surname(order.deceasedName);
    const payerHit = wordIn(reference, payer) || wordIn(counterparty, payer);
    const deceasedHit = !payerHit && (wordIn(reference, deceased) || wordIn(counterparty, deceased));
    const amountHit = amountsMatch(input.amountPounds, expected);

    let confidence: RevolutConfidence | null = null;
    let reason = '';
    if (refHit) {
      confidence = 'high';
      reason = `Reference contains order ${orderRef}`;
    } else if (payerHit && amountHit) {
      confidence = 'high';
      reason = `Payer surname "${payer}" and amount match`;
    } else if (payerHit) {
      confidence = 'medium';
      reason = `Payer surname "${payer}" only — confirm in Reconcile`;
    } else if (deceasedHit && amountHit) {
      confidence = 'medium';
      reason = `Deceased surname "${deceased}" and amount match — confirm in Reconcile`;
    } else if (deceasedHit) {
      confidence = 'low';
      reason = `Deceased surname "${deceased}" only`;
    } else if (amountHit) {
      confidence = 'low';
      reason = 'Amount only';
    }
    if (!confidence) continue;
    candidates.push({
      order_id: order.id,
      order_ref: orderRef,
      customer_name: displayName,
      expected_amount: expected,
      confidence,
      reason,
    });
  }

  candidates.sort((a, b) => RANK[a.confidence] - RANK[b.confidence] || a.order_ref.localeCompare(b.order_ref));
  const high = candidates.filter((c) => c.confidence === 'high');
  const auto = high.length === 1 ? high[0] : null;
  const matchReason = auto
    ? auto.reason
    : high.length > 1
      ? 'Several strong matches — confirm in Reconcile'
      : candidates.length
        ? 'Suggested only — confirm in Reconcile'
        : 'No matching order';

  return {
    candidates: candidates.slice(0, 5),
    autoMatchOrderId: auto?.order_id ?? null,
    matchReason,
  };
}
