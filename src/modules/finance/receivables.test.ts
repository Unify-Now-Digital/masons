import { describe, expect, it } from 'vitest';
import type { BrandData, InvoiceRow, OrderRow } from '@/modules/today/brandData.types';
import { financeKpiCards, financeKpis, invoiceSummary, paymentEvents, receivables, reconciliationFlags, suggestedAmount } from './receivables';
import { londonDayStartMs, londonMonthStartMs, londonNoonIso } from './londonTime';
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
      ['invoices', 'Unpaid · 7 days', 120],
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
  it('counts Revolut cash in Europe/London, completed only, and drops a matched manual twin', () => {
    expect(londonDayStartMs(Date.parse('2026-10-14T22:30:00Z'))).toBe(Date.parse('2026-10-13T23:00:00Z'));
    expect(londonMonthStartMs(NOW)).toBe(Date.parse('2026-09-30T23:00:00Z'));
    expect(londonNoonIso('2026-10-14')).toBe('2026-10-14T11:00:00.000Z');
    expect(londonNoonIso('2026-12-14')).toBe('2026-12-14T12:00:00.000Z');
    const pay = (id: string, p: Partial<BrandData['orderPayments'][number]>) => ({
      id, order_id: 'o1', source: 'revolut', amount: 10, payment_type: 'deposit', status: 'matched' as const,
      received_at: '2026-10-14T10:00:00Z', external_id: id, reference: null, provider_state: 'completed', ...p,
    });
    const d: BrandData = { ...empty, orders: [order('o1', { value: 500, deposit_date: '2026-10-01' })], orderPayments: [
      pay('today', { amount: 10, received_at: '2026-10-13T23:30:00Z' }),
      pay('yesterday', { amount: 20, received_at: '2026-10-13T22:00:00Z' }),
      pay('month-open', { amount: 30, received_at: '2026-09-30T23:30:00Z' }),
      pay('before-month', { amount: 40, received_at: '2026-09-30T22:00:00Z' }),
      pay('pending', { amount: 50, provider_state: 'pending', received_at: '2026-10-14T11:00:00Z' }),
      pay('manual-twin', { source: 'revolut', external_id: 'manual:abc', amount: 10, received_at: '2026-10-14T09:00:00Z' }),
      pay('revolut-twin', { external_id: 'txn-dup', amount: 10, received_at: '2026-10-14T09:30:00Z' }),
    ] };
    const kpi = financeKpis(d, NOW);
    expect(kpi.today).toMatchObject({ total: 20, revolut: 20 });
    expect(kpi.mtd).toMatchObject({ total: 70, revolut: 70 });
    expect(paymentEvents(d).some((event) => event.id === 'op:pending')).toBe(false);
    expect(paymentEvents(d).some((event) => event.id === 'op:manual-twin')).toBe(false);
    expect(reconciliationFlags(d).some((flag) => flag.kind === 'Likely manual duplicate of Revolut')).toBe(true);
  });
  it('warns on a manual duplicate even while the Revolut row is still unmatched', () => {
    const d: BrandData = { ...empty, orderPayments: [
      { id: 'm', order_id: 'o1', source: 'revolut', amount: 80, payment_type: 'deposit', status: 'matched', received_at: '2026-10-10T10:00:00Z', external_id: 'manual:1', reference: null },
      { id: 'r', order_id: null, source: 'revolut', amount: 80, payment_type: null, status: 'unmatched', received_at: '2026-10-11T10:00:00Z', external_id: 'txn-open', reference: null, provider_state: 'completed' },
    ] };
    expect(financeKpis(d, NOW).mtd.total).toBe(80);
    expect(reconciliationFlags(d).map((flag) => flag.kind)).toContain('Likely manual duplicate of Revolut');
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
