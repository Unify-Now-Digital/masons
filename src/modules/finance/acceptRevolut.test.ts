import { describe, expect, it } from 'vitest';
import type { OrderPaymentRow } from '@/modules/today/brandData.types';
import { acceptRevolutDecision, ignoreRevolutDecision, isOpenRevolutItem, paidSoFar, revolutAcceptable } from './acceptRevolut';

const row = (p: Partial<OrderPaymentRow> = {}): OrderPaymentRow => ({
  id: 'pay-1',
  order_id: null,
  source: 'revolut',
  amount: 250,
  payment_type: null,
  status: 'unmatched',
  received_at: '2026-10-14T10:00:00Z',
  external_id: 'txn-1',
  reference: '272',
  provider_state: 'completed',
  ...p,
});

describe('acceptRevolutDecision', () => {
  it('matches an unmatched Revolut row as a deposit when nothing is paid', () => {
    const decision = acceptRevolutDecision(row(), 'order-1', 0, 'office@example.com', '2026-10-14T12:00:00Z');
    expect(decision.kind).toBe('update');
    if (decision.kind !== 'update') return;
    expect(decision.patch).toMatchObject({
      order_id: 'order-1',
      source: 'revolut',
      status: 'matched',
      matched_by: 'office@example.com',
      payment_type: 'deposit',
      match_reason: 'Accepted in Reconcile',
    });
  });

  it('uses final once the order already has a matched payment', () => {
    const decision = acceptRevolutDecision(row(), 'order-1', 100, 'office@example.com', '2026-10-14T12:00:00Z');
    expect(decision.kind).toBe('update');
    if (decision.kind !== 'update') return;
    expect(decision.patch).toMatchObject({ payment_type: 'final' });
  });

  it('is a no-op when the same order is already matched', () => {
    expect(acceptRevolutDecision(row({ status: 'matched', order_id: 'order-1' }), 'order-1', 250, 'a', 't').kind).toBe('already');
  });

  it('refuses a row matched to a different order, a manual row, and a row with no transaction id', () => {
    expect(acceptRevolutDecision(row({ status: 'matched', order_id: 'other' }), 'order-1', 0, 'a', 't').kind).toBe('conflict');
    expect(acceptRevolutDecision(row({ source: 'bank', external_id: 'manual:1' }), 'order-1', 0, 'a', 't').kind).toBe('not_revolut');
    expect(acceptRevolutDecision(row({ external_id: null }), 'order-1', 0, 'a', 't').kind).toBe('no_transaction');
    expect(acceptRevolutDecision(null, 'order-1', 0, 'a', 't').kind).toBe('missing');
  });

  it('ignores only an unmatched Revolut row, and a second ignore is already done', () => {
    const decision = ignoreRevolutDecision(row(), 'office@example.com', '2026-10-14T12:00:00Z');
    expect(decision.kind).toBe('update');
    if (decision.kind !== 'update') return;
    expect(decision.patch).toMatchObject({ status: 'dismissed', order_id: null, source: 'revolut', match_reason: 'Ignored in Reconcile' });
    expect(ignoreRevolutDecision(row({ status: 'dismissed' }), 'a', 't').kind).toBe('already');
    expect(ignoreRevolutDecision(row({ status: 'matched', order_id: 'order-1' }), 'a', 't').kind).toBe('conflict');
  });

  it('keeps pending in the queue but not acceptable, and sums matched pounds', () => {
    expect(isOpenRevolutItem(row({ provider_state: 'pending' }))).toBe(true);
    expect(revolutAcceptable(row({ provider_state: 'pending' }))).toBe(false);
    expect(revolutAcceptable(row())).toBe(true);
    expect(isOpenRevolutItem(row({ provider_state: 'reverted' }))).toBe(false);
    expect(paidSoFar('order-1', [
      row({ order_id: 'order-1', status: 'matched', amount: '10.50' }),
      row({ order_id: 'order-1', status: 'unmatched', amount: 99 }),
      row({ order_id: 'other', status: 'matched', amount: 5 }),
    ])).toBe(10.5);
  });
});
