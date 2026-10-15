import { describe, expect, it } from 'vitest';
import type { BrandData, InvoiceRow, OrderRow } from '@/modules/today/brandData.types';
import { financeKpiCards, financeKpis, invoiceSummary, receivables, reconciliationFlags, suggestedAmount } from './receivables';
import { financeItems, salesItems } from '@/modules/today/todayRules';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const order = (id: string, p: Partial<OrderRow> = {}): OrderRow => ({
  id, order_number: Number(id.replace(/\D/g, '')) || 1, customer_name: `C ${id}`, person_name: null, person_id: null, job_id: null, value: 2000, permit_cost: 0,
  deposit_date: null, second_payment_date: null, installation_date: null, stone_status: 'NA', inscription_status: 'pending', proof_status: null,
  invoice_id: null, created_at: '2026-09-01T00:00:00Z', is_test: false, job: { stage: 'confirmed', exit_reason: null, paid_at: null }, ...p,
});
const inv = (id: string, p: Partial<InvoiceRow> = {}): InvoiceRow => ({
  id, order_id: null, invoice_number: id, customer_name: 'X', amount: 1000, status: 'pending', issue_date: '2026-10-01', due_date: null,
  stripe_invoice_status: 'open', stripe_invoice_id: 'in_1', stripe_payment_intent_id: null, is_test: false, paid_at: null, created_at: '2026-10-01T00:00:00Z', ...p,
});
const empty: BrandData = { jobs: [], orders: [], convs: [], permits: [], orderPayments: [], invoices: [], invoicePayments: [] };

describe('receivables', () => {
  it('owed = value + permit − Σ order_payments (the #272 / #274 cases)', () => {
    const d: BrandData = { ...empty,
      orders: [order('o272', { value: 1943, deposit_date: '2026-10-02' }), order('o274', { value: 2560, permit_cost: 345, deposit_date: '2026-10-08' })],
      orderPayments: [
        { id: 'p1', order_id: 'o272', source: 'revolut', amount: 1943, payment_type: 'deposit', status: 'matched', received_at: '2026-10-02T10:00:00Z', external_id: 'r1', reference: null },
        { id: 'p2', order_id: 'o274', source: 'revolut', amount: '1480', payment_type: 'deposit', status: 'matched', received_at: '2026-10-08T10:00:00Z', external_id: 'r2', reference: null },
      ] };
    const r = receivables(d, NOW);
    expect(r.find((x) => x.orderId === 'o272')!.remaining).toBe(0);
    expect(r.find((x) => x.orderId === 'o274')!.remaining).toBe(1425);
  });
  it('deposit date with no amount → Record payment; no deposit, no invoice → Raise invoice; in stock → Request balance', () => {
    const d: BrandData = { ...empty, orders: [
      order('a', { deposit_date: '2026-06-01' }), order('b'),
      order('c', { stone_status: 'In Stock', job: { stage: 'confirmed', exit_reason: null, paid_at: '2026-09-01' } }),
    ] };
    const r = Object.fromEntries(receivables(d, NOW).map((x) => [x.orderId, x.action]));
    expect(r).toEqual({ a: 'Record payment', b: 'Raise invoice', c: 'Request balance' });
  });
  it('counts a paid Stripe invoice once even when the payment is also an order_payments row', () => {
    const d: BrandData = { ...empty, orders: [order('o1', { value: 1000 })],
      invoices: [inv('i1', { order_id: 'o1', status: 'paid', stripe_payment_intent_id: 'pi_1' })],
      invoicePayments: [{ id: 'ip1', invoice_id: 'i1', amount: 100000, status: 'paid', stripe_payment_intent_id: 'pi_1', stripe_charge_id: null, created_at: '2026-10-10T00:00:00Z', received_at: null, source: null }],
      orderPayments: [{ id: 'p1', order_id: 'o1', source: 'stripe', amount: 1000, payment_type: 'final', status: 'matched', received_at: '2026-10-10T00:00:00Z', external_id: 'pi_1', reference: null }] };
    expect(receivables(d, NOW)[0].paid).toBe(1000);
    expect(financeKpis(d, NOW).mtd).toMatchObject({ total: 1000, stripe: 1000 });
  });
  it('kpi cards stay in order and invoices unpaid is only the loaded 0–7d bucket', () => {
    const d: BrandData = { ...empty, invoices: [
      inv('recent', { amount: 120, issue_date: '2026-10-12' }),
      inv('old', { amount: 800, issue_date: '2026-08-01' }),
      inv('voided', { amount: '14000.00', stripe_invoice_status: 'void', issue_date: '2026-10-13' }),
    ] };
    const cards = financeKpiCards(financeKpis(d, NOW));
    expect(cards.map((c) => [c.id, c.label, c.value])).toEqual([
      ['mtd', 'Cash in this month', 0],
      ['today', 'Cash in today', 0],
      ['invoices', 'Invoices unpaid · last 7 days', 120],
      ['balances', 'Balances due on fixing', 0],
      ['owed', 'Owed to us', 0],
    ]);
    expect(cards.find((c) => c.id === 'invoices')?.tone).toBe('red');
    expect(cards.find((c) => c.id === 'owed')?.tone).toBe('amber');
    expect(financeKpis(d, NOW).invoices.live.total).toBe(920);
  });
  it('invoices void in Stripe are reported separately, not silently dropped (the SM £43,230.40 case)', () => {
    const s = invoiceSummary([inv('a', { stripe_invoice_status: 'void', amount: '14000.00' }), inv('b', { amount: 500 }), inv('t', { amount: 3 })], NOW);
    expect(s.live).toMatchObject({ count: 1, total: 500 });
    expect(s.voidInStripe).toMatchObject({ count: 1, total: 14000 });
  });
  it('flags Barclays (unverified) and Mason vs Stripe mismatch over £1', () => {
    const d: BrandData = { ...empty, invoices: [inv('nocharge', { status: 'paid' }), inv('mm', { status: 'paid', amount: 1000 })],
      invoicePayments: [{ id: 'x', invoice_id: 'mm', amount: 99000, status: 'paid', stripe_payment_intent_id: 'pi', stripe_charge_id: null, created_at: null, received_at: null, source: null }] };
    expect(reconciliationFlags(d).map((f) => f.kind)).toEqual(['Barclays (unverified)', 'Mason vs Stripe mismatch']);
  });
  it('suggests 50% for a first deposit, else what is left', () => {
    expect(suggestedAmount({ total: 2000, paid: 0, remaining: 2000 }, 'deposit')).toBe(1000);
    expect(suggestedAmount({ total: 2000, paid: 1000, remaining: 1000 }, 'final')).toBe(1000);
  });
  it('Finance lane: one row per action + one FLAG for void-in-Stripe invoices', () => {
    const d: BrandData = { ...empty, orders: [order('a', { deposit_date: '2026-06-01' })], invoices: [inv('v1', { stripe_invoice_status: 'void' }), inv('v2', { stripe_invoice_status: 'void' })] };
    expect(financeItems(d, NOW).map((i) => i.verb)).toEqual(['Record payment', 'FLAG']);
  });
});

describe('sales rules', () => {
  const job = (id: string, stage: string, created: string, lastIn: string | null, lastOut: string | null) => ({
    id, stage, created_at: created, updated_at: null, paid_at: null, wake_at: null, exit_reason: null, person_id: null,
    person: { first_name: id, last_name: null, email: null }, conversation: { id: `c${id}`, last_inbound_at: lastIn, last_outbound_at: lastOut, ai_category: null },
  });
  it('new uncontacted enquiry under 48h → CALL; they replied → QUOTE/REPLY; quiet quote → CHASE', () => {
    const d: BrandData = { ...empty, jobs: [
      job('n', 'enquired', '2026-10-14T02:00:00Z', '2026-10-14T02:00:00Z', null),
      job('r', 'enquired', '2026-10-01T00:00:00Z', '2026-10-13T00:00:00Z', '2026-10-05T00:00:00Z'),
      job('q', 'quoted', '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z', '2026-09-20T00:00:00Z'),
    ] };
    expect(salesItems(d, NOW).map((i) => `${i.key}:${i.verb}`)).toEqual(['job:n:CALL', 'job:r:QUOTE', 'job:q:CHASE']);
  });
});
