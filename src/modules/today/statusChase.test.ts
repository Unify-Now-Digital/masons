import { describe, expect, it } from 'vitest';
import type { BrandData, OrderRow } from './brandData.types';
import { statusChaseItems } from './todayRules';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const order = (status: NonNullable<OrderRow['paymentStatus']>): OrderRow => ({
  id: 'o1', order_number: 12, customer_name: 'Ada', person_name: null, person_id: 'p1', job_id: null,
  value: 9000, permit_cost: 200, deposit_date: null, second_payment_date: null, installation_date: null,
  stone_status: null, inscription_status: null, proof_status: null, invoice_id: null,
  created_at: '2026-10-01T00:00:00Z', is_test: false, job: null, paymentStatus: status,
});
const data = (orders: OrderRow[]): BrandData => ({
  jobs: [], orders, convs: [], permits: [], orderPayments: [], invoices: [], invoicePayments: [],
});

describe('statusChaseItems', () => {
  it('asks for the deposit without a pound amount', () => {
    const items = statusChaseItems(data([order({ deposit_received: false, fully_paid: false, balance_outstanding: true })]), NOW);
    expect(items).toHaveLength(1);
    expect(items[0].why).toBe('Deposit not received');
    expect(items[0].valueGbp).toBeNull();
    expect(items[0].why).not.toMatch(/£/);
  });

  it('asks for the balance once the deposit is in, still with no amount', () => {
    const items = statusChaseItems(data([order({ deposit_received: true, fully_paid: false, balance_outstanding: true })]), NOW);
    expect(items[0].why).toBe('Balance outstanding');
    expect(JSON.stringify(items)).not.toMatch(/£|9000/);
  });

  it('skips a fully paid order', () => {
    const items = statusChaseItems(data([order({ deposit_received: true, fully_paid: true, balance_outstanding: false })]), NOW);
    expect(items).toEqual([]);
  });
});
