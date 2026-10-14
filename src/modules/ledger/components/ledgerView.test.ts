import { describe, expect, it } from 'vitest';
import type { LedgerPaymentRow } from '../api/ledger.api';
import { allocationLabel, filterRows, groupOf, primaryAction, sortRows } from './ledgerView';

const row = (o: Partial<LedgerPaymentRow>): LedgerPaymentRow => ({
  id: 'p', source: 'revolut', kind: 'payment', receivedAt: '2026-10-01T10:00:00Z', grossPence: 50000, feePence: 0, netPence: 50000,
  currency: 'GBP', payerName: 'Jane Doyle', payerEmail: null, customerName: null, memorialName: null, reference: 'OR-123',
  method: null, isPassThrough: false, status: 'unmatched', matchReason: null, allocations: [], suggestions: [], ...o,
});

describe('ledger view', () => {
  it('groups: review, matched, waiting', () => {
    expect(['unmatched', 'suggested', 'matched', 'pending', 'ignored'].map((s) => groupOf(s as never))).toEqual(['review', 'review', 'matched', 'waiting', 'ignored']);
  });
  it('sorts needs-review first, unmatched before suggested', () => {
    const out = sortRows([row({ id: 'm', status: 'matched' }), row({ id: 'w', status: 'pending' }), row({ id: 's', status: 'suggested' }), row({ id: 'u', status: 'unmatched' })]);
    expect(out.map((r) => r.id)).toEqual(['u', 's', 'm', 'w']);
  });
  it('one primary action per row', () => {
    expect(primaryAction(row({ status: 'suggested', suggestions: [{ invoiceId: 'i', orderId: null, score: 60, reasons: [], invoiceNumber: 'INV-000001', orderNumber: 1, customerName: null, remainingPence: 1 }] }))).toBe('confirm');
    expect(primaryAction(row({ status: 'unmatched' }))).toBe('match');
    expect(primaryAction(row({ status: 'matched' }))).toBe('menu');
    expect(primaryAction(row({ status: 'pending' }))).toBe(null);
  });
  it('allocation label uses the one ORD- format', () => {
    expect(allocationLabel(row({ allocations: [{ id: 'a', invoiceId: 'i', orderId: null, amountPence: 1, type: 'deposit', invoiceNumber: 'INV-000001', invoiceType: 'deposit', orderNumber: 123 }] }))).toBe('ORD-000123 · Deposit');
  });
  it('search finds ORD-, OR- or a bare order number; refunds filter', () => {
    const m = row({ id: 'm', status: 'matched', reference: 'x', allocations: [{ id: 'a', invoiceId: 'i', orderId: null, amountPence: 1, type: 'permit', invoiceNumber: 'INV-000009', invoiceType: null, orderNumber: 123 }] });
    const r = row({ id: 'r', grossPence: -100, reference: 'refund' });
    for (const q of ['ORD-000123', 'or-123', '123']) expect(filterRows([m, r], { search: q }).map((x) => x.id)).toEqual(['m']);
    expect(filterRows([m, r], { type: 'refund' }).map((x) => x.id)).toEqual(['r']);
    expect(filterRows([m, r], { type: 'permit' }).map((x) => x.id)).toEqual(['m']);
  });
});
