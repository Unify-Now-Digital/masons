/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { primeDraft } from '@/modules/inbox/utils/primedDraft';
import { Tier, type TodayItem } from './todayModel';
import type { BrandData, InvoicePaymentRow, InvoiceRow, OrderPaymentRow, OrderRow } from './brandData.types';
import { prepare, pricesAreSubset, stripeDepositMatches } from './prepare';

const NOW = Date.parse('2026-10-15T12:00:00Z');

function item(p: Partial<TodayItem> & Pick<TodayItem, 'key' | 'lane' | 'name'>): TodayItem {
  return {
    verb: 'REPLY', colour: 'red', tier: Tier.Waiting, why: p.name, to: '/',
    daysSinceOut: null, quietDays: 0, carriedDays: 0, sinceAt: null,
    kind: 'reply', bucket: 'today', waitingOn: 'us', waitingSince: new Date(NOW), lateBy: 0,
    reasons: [], factors: [], evidence: [], short: 'message', ...p,
  };
}

function brand(partial: Partial<BrandData> = {}): BrandData {
  return { jobs: [], orders: [], convs: [], permits: [], orderPayments: [], invoices: [], invoicePayments: [], ...partial };
}

const order = { id: 'o1', customer_name: 'Ada', person_id: 'ada', deposit_date: '2026-10-15' } as OrderRow;

describe('prepare', () => {
  it('rejects a message body whose price is not in its sources', () => {
    expect(pricesAreSubset('Please pay £10.', ['The quote is £10'])).toBe(true);
    expect(pricesAreSubset('Please pay £10.', ['The quote is £20'])).toBe(false);
    primeDraft('conv-price', 'Please pay £999 today.');
    const priced = item({ key: 'm', lane: 'Sales', name: 'Ada', channel: 'email', conversationId: 'conv-price' });
    expect(prepare(priced, brand())).toBeNull();
  });

  it('prepares a reply from the existing chase template', () => {
    const row = item({ key: 'm', lane: 'Sales', name: 'Ada Cole', channel: 'gmail' });
    const prepared = prepare(row, brand());
    expect(prepared?.type).toBe('message');
    if (prepared?.type !== 'message') return;
    expect(prepared.primary).toBe('Send & next');
    expect(prepared.channel).toBe('email');
    expect(prepared.body.join('\n')).toContain('Ada');
  });

  it('suggests a deposit only when exactly one Stripe payment matches', () => {
    const fix = item({
      key: 'f', lane: 'Finance', name: 'Ada', kind: 'fix', verb: 'Record payment',
      why: 'deposit amount', short: 'deposit', sinceAt: '2026-10-15T12:00:00Z', orderId: 'o1',
    });
    const invoice = { id: 'inv', order_id: 'o1', customer_name: 'Ada' } as InvoiceRow;
    const pay = (id: string, amount: number): InvoicePaymentRow => ({
      id, invoice_id: 'inv', amount, source: 'stripe', received_at: '2026-10-14T12:00:00Z',
      stripe_payment_intent_id: id, status: 'succeeded', stripe_charge_id: null, created_at: null,
    });
    const none = prepare(fix, brand({ orders: [order], invoices: [invoice] }));
    expect(none?.type).toBe('fields');
    if (none?.type === 'fields') {
      expect(none.primary).toBe('Choose payment');
      expect(none.fields[0].value).toBe('');
    }
    const one = prepare(fix, brand({ orders: [order], invoices: [invoice], invoicePayments: [pay('a', 25000)] }));
    if (one?.type === 'fields') {
      expect(one.primary).toBe('Save & next');
      expect(one.fields[0].value).toBe('£250.00');
      expect(one.uses.join(' ')).toContain('£250.00');
    } else {
      expect(one?.type).toBe('fields');
    }
    const two = prepare(fix, brand({ orders: [order], invoices: [invoice], invoicePayments: [pay('a', 25000), pay('b', 10000)] }));
    if (two?.type === 'fields') expect(two.primary).toBe('Choose payment');
    const pounds = stripeDepositMatches(fix, brand({
      orders: [order],
      orderPayments: [{
        id: 'op', order_id: 'o1', source: 'stripe', amount: 40, received_at: '2026-10-15T12:00:00Z',
        counterparty_name: 'Ada', status: null, payment_type: null, external_id: null, reference: null,
      } as OrderPaymentRow],
    }), order);
    expect(pounds).toEqual([{ amount: 40, at: '2026-10-15T12:00:00Z' }]);
  });

  it('prepares permit fields from the order and a stone draft even when fields are missing', () => {
    const permit = item({ key: 'p', lane: 'Permits', name: 'Ada', kind: 'send', verb: 'Send form', orderId: 'o1' });
    const withOrder = { ...order, sku: 'A12', custom_product_name: 'Tablet', inscription_text: 'In memory' } as OrderRow;
    const form = prepare(permit, brand({ orders: [withOrder] }));
    expect(form?.type).toBe('fields');
    if (form?.type === 'fields') {
      expect(form.primary).toBe('Send & next');
      expect(form.fields.map((field) => field.label)).toEqual(['Plot', 'Memorial', 'Inscription', 'Owner signature', 'Deed number']);
      expect(form.fields.find((field) => field.label === 'Owner signature')?.note).toBe('missing');
    }
    const stone = item({ key: 's', lane: 'Proofs', name: 'Ada', kind: 'order', orderId: 'o1', personId: 'ada' });
    const draft = prepare(stone, brand({ orders: [withOrder] }));
    expect(draft?.type).toBe('fields');
    if (draft?.type === 'fields') {
      expect(draft.primary).toBe('Send & next');
      expect(draft.fields.find((field) => field.label === 'Material')?.note).toBe('missing');
      expect(draft.fields.find((field) => field.label === 'Product')?.value).toBe('Tablet');
    }
  });

  it('prepares call notes when the item is a call', () => {
    const call = item({ key: 'c', lane: 'CS', name: 'Bea', kind: 'call', lateBy: 200, why: 'fixing date question' });
    const prepared = prepare(call, brand());
    expect(prepared?.type).toBe('call');
    if (prepared?.type === 'call') {
      expect(prepared.outcomes).toHaveLength(3);
      expect(prepared.primary).toBe('Logged & next');
    }
  });

  it('prepares a reply without a channel, a proof, and a system flag', () => {
    const reply = prepare(item({ key: 'r', lane: 'Sales', name: 'Ada Cole', kind: 'reply' }), brand());
    expect(reply?.type).toBe('message');
    if (reply?.type === 'message') expect(reply.primary).toBe('Send & next');
    const proof = prepare(item({ key: 'p', lane: 'Proofs', name: 'Ada', kind: 'send', verb: 'Send proof' }), brand());
    expect(proof?.type).toBe('message');
    if (proof?.type === 'message') expect(proof.body.join('\n')).toContain('proof');
    const flag = prepare(item({
      key: 'fin:void-in-stripe', lane: 'Finance', name: '10 invoices void in Stripe', kind: 'fix', verb: 'FLAG',
      why: 'Pending in Mason but void in Stripe',
    }), brand());
    expect(flag?.type).toBe('fields');
    if (flag?.type === 'fields') expect(flag.primary).toBe('Open & next');
  });
});
