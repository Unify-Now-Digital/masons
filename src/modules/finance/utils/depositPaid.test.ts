import { describe, it, expect } from 'vitest';
import { depositPaidOrderIds } from './depositPaid';

const inv = (id: string, order_id: string | null, extra: Partial<{ status: string; amount_paid: number; paid_at: string }> = {}) => ({
  id, order_id, status: extra.status ?? 'pending', amount_paid: extra.amount_paid ?? 0, paid_at: extra.paid_at ?? null,
});

describe('depositPaidOrderIds', () => {
  it('counts only orders with a paid deposit, not job stage', () => {
    const orders = [
      { id: 'o1', deposit_date: '2026-10-01', invoice_id: null }, // deposit_date set
      { id: 'o2', deposit_date: null, invoice_id: 'i2' },          // linked paid invoice
      { id: 'o3', deposit_date: null, invoice_id: null },          // paid invoice via order_id
      { id: 'o4', deposit_date: null, invoice_id: 'i4' },          // pending invoice, unpaid
      { id: 'o5', deposit_date: null, invoice_id: 'i5' },          // payment row recorded
      { id: 'o6', deposit_date: null, invoice_id: null },          // nothing
    ];
    const invoices = [
      inv('i2', null, { status: 'paid' }),
      inv('i3', 'o3', { amount_paid: 250 }),
      inv('i4', 'o4'),
      inv('i5', null),
    ];
    expect(depositPaidOrderIds(orders, invoices, new Set(['i5']))).toEqual(['o1', 'o2', 'o3', 'o5']);
  });

  it('returns empty when nothing is paid', () => {
    expect(depositPaidOrderIds([{ id: 'o', deposit_date: null, invoice_id: 'i' }], [inv('i', 'o', { status: 'draft' })], new Set())).toEqual([]);
  });
});
