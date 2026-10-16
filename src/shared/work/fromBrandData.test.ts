import { describe, expect, it } from 'vitest';
import type { BrandData, OrderRow } from '@/modules/today/brandData.types';
import { workItemsFromBrandData } from './fromBrandData';

const NOW = new Date('2026-10-15T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const order = (o: Partial<OrderRow>): OrderRow => ({
  id: 'o1', order_number: 101, customer_name: 'Fixture One', person_name: null, person_id: 'p1', job_id: 'j1', value: 2000, permit_cost: 180,
  deposit_date: null, second_payment_date: null, installation_date: null, stone_status: null, inscription_status: null, proof_status: null,
  invoice_id: null, created_at: daysAgo(5), is_test: false, job: { stage: 'confirmed', exit_reason: null, paid_at: daysAgo(4) }, ...o,
});
const data = (o: Partial<BrandData>): BrandData => ({ jobs: [], orders: [], convs: [], permits: [], orderPayments: [], invoices: [], invoicePayments: [], ...o });

describe('workItemsFromBrandData', () => {
  it('a won order with permit form needed shows as send_permit (Phase D acceptance precursor)', () => {
    const d = data({
      orders: [order({})],
      permits: [{ id: 'pm1', order_id: 'o1', permit_phase: 'form_needed', next_action: null, waiting_on: null, sent_at: null, submitted_at: null, returned_at: null, stage_entered_at: daysAgo(1) }],
    });
    const items = workItemsFromBrandData(d, NOW, { lanes: ['permit'] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'permit:o1', verb: 'send_permit', ref: '#101', urgency: 'ok' });
  });
  it('proofs come from orders.proof_status; lanes / orderId filters apply; output is ranked', () => {
    const d = data({ orders: [order({ proof_status: 'Revision' }), order({ id: 'o2', order_number: 102, proof_status: 'Sent' })] });
    const items = workItemsFromBrandData(d, NOW, { lanes: ['proof'] });
    expect(items.map((i) => i.verb)).toEqual(['revise_proof', 'chase_proof']);
    expect(workItemsFromBrandData(d, NOW, { lanes: ['proof'], orderId: 'o2' }).map((i) => i.id)).toEqual(['proof:o2']);
  });
  it('payment lane hidden without money access; unmatched lines become reconcile', () => {
    const d = data({ orderPayments: [{ id: 'pay1', order_id: null, source: 'bank', amount: 50, payment_type: null, status: 'unmatched', received_at: daysAgo(1), external_id: null, reference: 'R' }] });
    expect(workItemsFromBrandData(d, NOW, { lanes: ['payment'], canSeeMoney: false })).toEqual([]);
    expect(workItemsFromBrandData(d, NOW, { lanes: ['payment'] })[0]).toMatchObject({ verb: 'reconcile', value: 50 });
  });

  it('status chase has no amount when money is hidden', () => {
    const d = data({
      orders: [order({
        paymentStatus: { deposit_received: false, fully_paid: false, balance_outstanding: true },
      })],
      orderPayments: [{ id: 'pay1', order_id: null, source: 'bank', amount: 50, payment_type: null, status: 'unmatched', received_at: daysAgo(1), external_id: null, reference: 'R' }],
    });
    const items = workItemsFromBrandData(d, NOW, { lanes: ['payment'], canSeeMoney: false });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ verb: 'request_deposit', value: null, blocker: 'Deposit not received' });
    expect(JSON.stringify(items[0])).not.toMatch(/£|50/);
  });
});
