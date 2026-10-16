import { describe, expect, it } from 'vitest';
import type { BrandData, InvoiceRow, OrderPaymentRow, OrderRow } from '@/modules/today/brandData.types';
import { buildFinanceQueue, queueCounts, rowsForFilter } from './queue';

const NOW = Date.parse('2026-10-14T12:00:00Z');

const order = (id: string, p: Partial<OrderRow> = {}): OrderRow => ({
  id, order_number: Number(id.replace(/\D/g, '')) || 1, customer_name: `C ${id}`, person_name: null, person_id: null, job_id: null,
  value: 2000, permit_cost: 0, deposit_date: null, second_payment_date: null, installation_date: null, stone_status: 'NA',
  inscription_status: null, proof_status: null, invoice_id: null, created_at: '2026-09-01T00:00:00Z', is_test: false,
  job: { stage: 'confirmed', exit_reason: null, paid_at: null }, ...p,
});

const pay = (id: string, p: Partial<OrderPaymentRow> = {}): OrderPaymentRow => ({
  id, order_id: null, source: 'revolut', amount: 1500, payment_type: 'deposit', status: 'unmatched',
  received_at: '2026-10-01T00:00:00Z', external_id: null, reference: null, ...p,
});

const inv = (id: string, p: Partial<InvoiceRow> = {}): InvoiceRow => ({
  id, order_id: null, invoice_number: id, customer_name: 'X', amount: 1000, status: 'pending', issue_date: '2026-10-01',
  due_date: null, stripe_invoice_status: 'open', stripe_invoice_id: 'in_1', stripe_payment_intent_id: null,
  is_test: false, paid_at: null, created_at: '2026-10-01T00:00:00Z', ...p,
});

const empty: BrandData = { jobs: [], orders: [], convs: [], permits: [], orderPayments: [], invoices: [], invoicePayments: [] };

describe('finance queue', () => {
  const data = (): BrandData => ({
    ...empty,
    orders: [
      order('o-late', { value: 400, person_name: 'Late', deposit_date: '2026-08-01', installation_date: '2026-09-01', job: { stage: 'confirmed', exit_reason: null, paid_at: '2026-08-01' } }),
      order('o-big', { value: 5000, person_name: 'Big', deposit_date: '2026-10-01', job: { stage: 'confirmed', exit_reason: null, paid_at: '2026-10-01' } }),
      order('o-gap', { value: 900, person_name: 'Gap', deposit_date: '2026-10-02' }),
      order('o-paid', { value: 300, person_name: 'Paid', deposit_date: '2026-09-01', job: { stage: 'confirmed', exit_reason: null, paid_at: '2026-09-01' } }),
    ],
    orderPayments: [
      pay('p-rev', { amount: 1500, source: 'revolut', reference: 'WOOD' }),
      pay('p-paid', { order_id: 'o-paid', amount: 300, status: 'matched', source: 'stripe' }),
    ],
    invoices: [inv('voided', { amount: 80, stripe_invoice_status: 'void', customer_name: 'Voided' })],
  });

  it('ranks overdue first, then the largest amount', () => {
    const needs = rowsForFilter(buildFinanceQueue(data(), NOW), 'needs').map((r) => r.id);
    const late = needs.indexOf('bal:o-late');
    const big = needs.indexOf('bal:o-big');
    const gap = needs.indexOf('bal:o-gap');
    const rev = needs.indexOf('unmatched:op:p-rev');
    expect(late).toBeGreaterThanOrEqual(0);
    expect(late).toBeLessThan(big);
    expect(big).toBeLessThan(rev);
    expect(rev).toBeLessThan(gap);
  });

  it('describes a missing deposit and an unmatched Revolut payment', () => {
    const rows = buildFinanceQueue(data(), NOW);
    const gap = rows.find((r) => r.id === 'bal:o-gap')!;
    expect(gap).toMatchObject({
      chip: 'Record', button: 'Record payment', what: 'deposit marked, no amount', colour: 'amber', overdue: false,
    });
    expect(gap.filters).toEqual(expect.arrayContaining(['needs', 'outstanding']));
    expect(gap.filters).not.toContain('overdue');

    const rev = rows.find((r) => r.id === 'unmatched:op:p-rev')!;
    expect(rev.what).toBe('Revolut £1,500.00 · no order');
    expect(rev).toMatchObject({ chip: 'Match', button: 'Match', orderId: null, paymentId: 'p-rev' });
    expect(rev.filters).toEqual(expect.arrayContaining(['needs', 'unmatched']));
  });

  it('filter counts match the rows each chip shows', () => {
    const rows = buildFinanceQueue(data(), NOW);
    const counts = queueCounts(rows);
    for (const id of ['needs', 'unmatched', 'outstanding', 'overdue', 'paid', 'void', 'all'] as const) {
      expect(rowsForFilter(rows, id)).toHaveLength(counts[id]);
    }
    expect(counts.overdue).toBe(1);
    expect(counts.void).toBe(1);
    expect(counts.unmatched).toBe(1);
    expect(counts.paid).toBe(1);
    expect(counts.all).toBe(rows.length);
    expect(rowsForFilter(rows, 'void').map((r) => r.what)).toEqual(['Void in Stripe']);
    expect(rowsForFilter(rows, 'needs').some((r) => r.filters.includes('void'))).toBe(false);
    expect(rowsForFilter(rows, 'overdue')[0]).toMatchObject({ id: 'bal:o-late', ageLabel: expect.stringMatching(/^\d+d overdue$/) });
  });
});
