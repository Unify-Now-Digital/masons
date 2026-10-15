import { describe, expect, it } from 'vitest';
import { extractOrderNumber, matchStripeInvoice, type MatchLookups, type OrderRef } from './stripeInvoiceMatch';

const o282: OrderRef = { id: 'o282', person_id: 'p1', job_id: 'j1' };
const lookups = (over: Partial<MatchLookups> = {}): MatchLookups => ({
  invoiceExists: async () => false,
  orderByNumber: async (n) => (n === 282 ? o282 : null),
  openOrdersByEmail: async () => [],
  ...over,
});

describe('extractOrderNumber', () => {
  it('reads metadata.order', () => expect(extractOrderNumber({ id: 'x', metadata: { order: 'ORD-000282' } })).toBe(282));
  it('reads the memo', () => expect(extractOrderNumber({ id: 'x', description: 'Deposit for order ORD-000283: x' })).toBe(283));
  it('reads bare numbers in metadata.order_number', () => expect(extractOrderNumber({ id: 'x', metadata: { order_number: '12' } })).toBe(12));
  it('null when absent', () => expect(extractOrderNumber({ id: 'x', description: 'Order total £3,940' })).toBeNull());
});

describe('matchStripeInvoice', () => {
  it('prefers a Mason invoice id', async () => {
    const id = '344e7547-988a-4b2a-b4cb-62e1ef7b848c';
    const r = await matchStripeInvoice({ id: 'in', metadata: { mason_invoice_id: id, order: 'ORD-000282' } }, lookups({ invoiceExists: async () => true }));
    expect(r).toMatchObject({ kind: 'mason_invoice', masonInvoiceId: id });
  });
  it('then the order ref', async () => {
    const r = await matchStripeInvoice({ id: 'in', metadata: { order: 'ORD-000282' }, customer_email: 'a@b.c' }, lookups());
    expect(r).toMatchObject({ kind: 'order', order: o282 });
  });
  it('then a single open order by email', async () => {
    const r = await matchStripeInvoice({ id: 'in', customer_email: ' A@B.c ' }, lookups({ openOrdersByEmail: async (e) => (e === 'a@b.c' ? [o282] : []) }));
    expect(r).toMatchObject({ kind: 'order', order: o282 });
  });
  it('unmatched when the email has several open orders', async () => {
    const r = await matchStripeInvoice({ id: 'in', customer_email: 'a@b.c' }, lookups({ openOrdersByEmail: async () => [o282, o282] }));
    expect(r.kind).toBe('unmatched');
  });
  it('unmatched with nothing to go on', async () => {
    expect((await matchStripeInvoice({ id: 'in' }, lookups())).kind).toBe('unmatched');
  });
});
