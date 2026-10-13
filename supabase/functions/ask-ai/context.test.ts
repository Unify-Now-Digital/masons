import { describe, expect, it } from 'vitest';
import {
  buildMessages,
  buildOpenAiPayload,
  MAX_CONTEXT_CHARS,
  MAX_SAMPLE_ROWS,
  serialiseContext,
  summariseFinance,
  summariseOrders,
  summarisePipeline,
  validateAskAiBody,
} from './context';

const ORG = '11111111-2222-3333-4444-555555555555';
const TODAY = '2026-10-14';

describe('validateAskAiBody', () => {
  it('accepts a valid body and trims the question', () => {
    expect(validateAskAiBody({ page: 'finance', question: ' hi ', organization_id: ORG })).toEqual({
      ok: true,
      value: { page: 'finance', question: 'hi', organization_id: ORG },
    });
  });
  it('rejects bad page, empty/long question, bad org', () => {
    expect(validateAskAiBody({ page: 'inbox', question: 'q', organization_id: ORG }).ok).toBe(false);
    expect(validateAskAiBody({ page: 'orders', question: '', organization_id: ORG }).ok).toBe(false);
    expect(validateAskAiBody({ page: 'orders', question: 'x'.repeat(501), organization_id: ORG }).ok).toBe(false);
    expect(validateAskAiBody({ page: 'orders', question: 'q', organization_id: 'nope' }).ok).toBe(false);
    expect(validateAskAiBody(null).ok).toBe(false);
  });
});

describe('summaries', () => {
  it('orders: open, overdue, status counts', () => {
    const base = { customer_name: 'A', installation_date: null, permit_status: 'pending', proof_status: 'Sent' };
    const s = summariseOrders(
      [
        { ...base, order_number: 1, due_date: '2026-10-01', progress: 10, stone_status: 'Ordered' },
        { ...base, order_number: 2, due_date: '2026-11-01', progress: 50, stone_status: 'In Stock' },
        { ...base, order_number: 3, due_date: '2026-09-01', progress: 100, stone_status: 'In Stock' },
      ],
      TODAY,
    );
    expect(s.open_orders).toBe(2);
    expect(s.overdue_orders).toBe(1);
    expect(s.stone_status_counts).toEqual({ Ordered: 1, 'In Stock': 1 });
    expect(s.overdue_sample[0].order).toBe(1);
  });
  it('pipeline: stage counts exclude exited jobs', () => {
    const s = summarisePipeline([
      { stage: 'enquired', exit_reason: null },
      { stage: 'enquired', exit_reason: null },
      { stage: 'quoted', exit_reason: 'lost' },
    ]);
    expect(s.active_jobs).toBe(2);
    expect(s.stage_counts).toEqual({ enquired: 2 });
    expect(s.exited_counts).toEqual({ lost: 1 });
  });
  it('finance: pence amount_remaining converted, overdue detected', () => {
    const s = summariseFinance(
      [
        { invoice_number: 'I1', customer_name: 'A', amount: 500, amount_remaining: 25000, status: 'pending', due_date: '2026-10-01' },
        { invoice_number: 'I2', customer_name: 'B', amount: 100, amount_remaining: null, status: 'pending', due_date: '2026-12-01' },
        { invoice_number: 'I3', customer_name: 'C', amount: 999, status: 'paid', due_date: '2026-01-01' },
      ],
      [{ order_number: 7, customer_name: 'D', balance_due: 1200.5, installation_date: '2026-10-20' }],
      TODAY,
    );
    expect(s.outstanding_invoices).toBe(2);
    expect(s.outstanding_total).toBe(350);
    expect(s.overdue_invoices).toBe(1);
    expect(s.overdue_total).toBe(250);
    expect(s.balance_due_total).toBe(1200.5);
  });
  it('caps sample rows', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      order_number: i, customer_name: 'X', due_date: '2026-01-01', installation_date: null,
      progress: 0, stone_status: null, permit_status: null, proof_status: null,
    }));
    expect(summariseOrders(rows, TODAY).overdue_sample).toHaveLength(MAX_SAMPLE_ROWS);
  });
});

describe('serialiseContext + prompt', () => {
  it('keeps context under the cap', () => {
    const big = { list: Array.from({ length: 2000 }, (_, i) => ({ i, name: 'customer name here' })), n: 1 };
    const out = serialiseContext(big);
    expect(out.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
    expect(out).toContain('truncated');
  });
  it('builds read-only messages with the question and context', () => {
    const msgs = buildMessages('orders', 'Which are overdue?', '{"open_orders":2}', TODAY);
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toMatch(/read-only/);
    expect(msgs[0].content).toContain('Orders');
    expect(msgs[1].content).toContain('Which are overdue?');
    expect(msgs[1].content).toContain('"open_orders":2');
    const payload = buildOpenAiPayload(msgs);
    expect(payload.model).toBe('gpt-4o-mini');
    expect(payload.max_tokens).toBeLessThanOrEqual(400);
  });
});
