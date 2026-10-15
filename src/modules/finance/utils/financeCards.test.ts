import { describe, expect, it } from 'vitest';
import { buildFinanceCards } from './financeCards';

const today = new Date('2026-10-15T12:00:00Z');

describe('buildFinanceCards', () => {
  it('Grace: order incl. permit, open deposit invoice, completion balance still to invoice', () => {
    const c = buildFinanceCards(
      [{ id: 'o282', total_order_value: 4538.8, permit_cost: 286, permit_fee: 0 }],
      [{ order_id: 'o282', amount: 2555.4, amount_paid: 0, amount_remaining: 255540, status: 'pending', stripe_invoice_status: 'open', invoice_type: 'deposit', due_date: '2026-10-20' }],
      [],
      today,
    );
    expect(c.orderBook).toBeCloseTo(4824.8);
    expect(c.invoicedUnpaid).toBeCloseTo(2555.4);
    expect(c.stillToInvoice).toBeCloseTo(2269.4);
    expect(c.expectedTotal).toBeCloseTo(4824.8);
    expect(c.dueThisMonth).toBeCloseTo(2555.4);
    expect(c.overdue).toBe(0);
  });

  it('splits collected deposit/balance, ignores void, flags overdue and unmatched', () => {
    const c = buildFinanceCards(
      [{ id: 'a', total_order_value: 1000 }],
      [
        { order_id: 'a', amount: 400, status: 'paid', invoice_type: 'deposit' },
        { order_id: 'a', amount: 600, amount_paid: 10000, amount_remaining: 50000, status: 'pending', invoice_type: 'balance', due_date: '2026-10-01' },
        { order_id: 'a', amount: 999, status: 'pending', stripe_invoice_status: 'void' },
        { order_id: null, amount: 50, amount_remaining: 5000, status: 'pending', stripe_link_status: 'unmatched', due_date: '2026-11-30' },
      ],
      [{ order_id: null, amount: 20, payment_type: 'deposit' }],
      today,
    );
    expect(c.collectedDeposit).toBeCloseTo(420);
    expect(c.collectedBalance).toBeCloseTo(100);
    expect(c.invoicedUnpaid).toBeCloseTo(550);
    expect(c.overdue).toBeCloseTo(500);
    expect(c.overdueCount).toBe(1);
    expect(c.stillToInvoice).toBe(0);
    expect(c.unmatchedCount).toBe(1);
  });
});
