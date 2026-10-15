import { describe, expect, it } from 'vitest';
import { buildRevolutPaymentInsert, revolutResyncPatch } from '../../../../supabase/functions/_shared/revolut/buildPayment';
import { matchRevolutPayment, referenceHasOrderNumber, type RevolutMatchOrder } from '../../../../supabase/functions/_shared/revolut/match';
import { incomingLeg } from '../../../../supabase/functions/_shared/revolut/transaction';

const orders: RevolutMatchOrder[] = [
  { id: 'o272', orderNumber: 272, payerName: 'Jane Wood', deceasedName: 'Arthur Wood', balanceDue: 970 },
  { id: 'o273', orderNumber: 273, payerName: 'Sam Patel', deceasedName: 'Rita Patel', balanceDue: 500 },
  { id: 'o12', orderNumber: 12, payerName: 'Ann Cole', deceasedName: 'Bob Cole', balanceDue: 100 },
];

describe('matchRevolutPayment', () => {
  it('auto-matches a unique order number in the reference, even as a part payment', () => {
    const result = matchRevolutPayment({ amountPounds: 400, reference: 'Memorial ORD-000272', counterpartyName: 'J WOOD' }, orders);
    expect(result.autoMatchOrderId).toBe('o272');
    expect(result.candidates[0].confidence).toBe('high');
  });

  it('does not treat 272 as 1272, or a short order number as high confidence', () => {
    expect(referenceHasOrderNumber('1272', 272)).toBe(false);
    expect(referenceHasOrderNumber('order 2721', 272)).toBe(false);
    expect(referenceHasOrderNumber('#272', 272)).toBe(true);
    const short = matchRevolutPayment({ amountPounds: 100, reference: 'order 12', counterpartyName: null }, orders);
    expect(short.autoMatchOrderId).toBeNull();
    expect(short.candidates.find((c) => c.order_id === 'o12')?.confidence).not.toBe('high');
  });

  it('auto-matches one payer surname plus the amount to the penny', () => {
    const result = matchRevolutPayment({ amountPounds: 500, reference: 'rent', counterpartyName: 'From SAM PATEL' }, orders);
    expect(result.autoMatchOrderId).toBe('o273');
  });

  it('suggests a deceased surname or an amount-only hit and does not auto-match', () => {
    const deceased = matchRevolutPayment({ amountPounds: 970, reference: 'Arthur Wood memorial', counterpartyName: null }, [
      { id: 'o272', orderNumber: 272, payerName: 'Jane Smith', deceasedName: 'Arthur Wood', balanceDue: 970 },
    ]);
    expect(deceased.autoMatchOrderId).toBeNull();
    expect(deceased.candidates[0].confidence).toBe('medium');

    const amountOnly = matchRevolutPayment({ amountPounds: 500, reference: 'thanks', counterpartyName: 'ACME LTD' }, orders);
    expect(amountOnly.autoMatchOrderId).toBeNull();
    expect(amountOnly.candidates.every((c) => c.confidence === 'low')).toBe(true);
  });

  it('does not auto-match when two orders are both high confidence', () => {
    const result = matchRevolutPayment(
      { amountPounds: 100, reference: '272 and 273', counterpartyName: null },
      orders,
    );
    expect(result.autoMatchOrderId).toBeNull();
    expect(result.matchReason).toMatch(/Reconcile/);
  });

  it('name without the amount stays a suggestion', () => {
    const result = matchRevolutPayment({ amountPounds: 10, reference: null, counterpartyName: 'Jane Wood' }, orders);
    expect(result.autoMatchOrderId).toBeNull();
    expect(result.candidates[0]).toMatchObject({ order_id: 'o272', confidence: 'medium' });
  });
});

describe('incomingLeg', () => {
  it('keeps a positive external transfer and skips spend, fees, and our own pockets', () => {
    expect(incomingLeg({
      id: 't1', type: 'transfer', state: 'completed',
      legs: [{ amount: 10, currency: 'GBP', description: 'From JOHN SMITH', counterparty: { id: 'c1', account_type: 'external' } }],
    })?.amountPounds).toBe(10);
    expect(incomingLeg({ id: 't2', type: 'card_payment', legs: [{ amount: -20, currency: 'GBP' }] })).toBeNull();
    expect(incomingLeg({
      id: 't3', type: 'transfer',
      legs: [
        { amount: 100, currency: 'GBP', description: 'To pocket' },
        { amount: 100, currency: 'GBP', description: 'From pocket' },
      ],
    })).toBeNull();
    expect(incomingLeg({
      id: 't4', type: 'transfer',
      legs: [{ amount: 40, currency: 'GBP', counterparty: { account_type: 'self' } }],
    })).toBeNull();
  });
});

describe('buildRevolutPaymentInsert', () => {
  const txn = {
    id: 'txn_1', type: 'topup', state: 'completed', reference: 'ORD-000272',
    created_at: '2026-10-14T09:00:00Z', completed_at: '2026-10-14T09:05:00Z',
    legs: [{ leg_id: 'leg_1', account_id: 'acc_1', amount: 400, currency: 'GBP', description: 'From JANE WOOD', counterparty: { id: 'cp', account_type: 'external' } }],
  };

  it('posts a completed high-confidence receipt as matched, source revolut, transaction id', () => {
    const row = buildRevolutPaymentInsert({ organizationId: 'org', userId: 'user', txn, orders, nowIso: '2026-10-14T10:00:00Z' });
    expect(row).toMatchObject({
      source: 'revolut',
      external_id: 'txn_1',
      organization_id: 'org',
      order_id: 'o272',
      status: 'matched',
      matched_by: 'auto',
      amount: 400,
      currency: 'GBP',
      provider_state: 'completed',
      counterparty_name: 'JANE WOOD',
      received_at: '2026-10-14T09:05:00Z',
    });
  });

  it('leaves a weak match unmatched so the order is not marked paid', () => {
    const row = buildRevolutPaymentInsert({
      organizationId: 'org', userId: null,
      txn: { ...txn, reference: 'thanks', legs: [{ ...txn.legs[0], description: 'From SOMEONE ELSE' }] },
      orders,
    });
    expect(row?.status).toBe('unmatched');
    expect(row?.order_id).toBeNull();
    expect(row?.matched_by).toBeNull();
  });

  it('does not auto-match a pending receipt', () => {
    const row = buildRevolutPaymentInsert({ organizationId: 'org', userId: null, txn: { ...txn, state: 'pending', completed_at: undefined }, orders });
    expect(row?.status).toBe('unmatched');
    expect(row?.order_id).toBeNull();
    expect(row?.provider_state).toBe('pending');
  });

  it('dismisses a reverted receipt and does not overwrite a person\'s match on a later sync', () => {
    const row = buildRevolutPaymentInsert({ organizationId: 'org', userId: null, txn: { ...txn, state: 'reverted' }, orders });
    expect(row?.status).toBe('dismissed');
    expect(row?.order_id).toBeNull();
    expect(revolutResyncPatch({ status: 'matched', matched_by: 'owner@example.com' }, row!)).toMatchObject({
      status: 'dismissed',
      matched_by: 'owner@example.com',
    });
    const pending = buildRevolutPaymentInsert({ organizationId: 'org', userId: null, txn: { ...txn, state: 'pending' }, orders })!;
    expect(revolutResyncPatch({ status: 'matched', matched_by: 'owner@example.com' }, pending)).toEqual({
      provider_state: 'pending',
    });
  });
});
