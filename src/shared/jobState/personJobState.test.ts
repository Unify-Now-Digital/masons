import { describe, expect, it } from 'vitest';
import { isStatusPhrase, personJobState, type JobInvoiceFact, type JobOrderFact } from './personJobState';

const NOW = new Date('2026-10-16T12:00:00Z');

const order = (p: Partial<JobOrderFact> & Pick<JobOrderFact, 'id' | 'memorial'>): JobOrderFact => ({
  extras: 0, permit: 0, invoiceId: null, depositDate: null, ...p,
});
const invoice = (p: Partial<JobInvoiceFact> & Pick<JobInvoiceFact, 'id'>): JobInvoiceFact => ({
  orderId: null, jobId: null, amount: 0, status: 'pending', ...p,
});

describe('personJobState named cases (prod, 16 Oct 2026)', () => {
  it('Rosina Findlay: chase the £2,315 deposit, order stays £3,940, invoice links from invoices.order_id', () => {
    const state = personJobState({
      jobId: '2a215fdb-c471-4dac-9f1f-681dbc277d21',
      jobStage: 'invoiced',
      order: order({ id: '76fff9b3-2fb6-4cfd-9adb-9d6337a215e3', memorial: 3250, permit: 690, invoiceId: null }),
      invoices: [invoice({ id: '321267a4-b963-4c6a-84b4-1210246e6dca', orderId: '76fff9b3-2fb6-4cfd-9adb-9d6337a215e3', jobId: '2a215fdb-c471-4dac-9f1f-681dbc277d21', amount: 2315 })],
      sentQuote: 3250,
      paid: 0,
      lastIn: '2026-10-15T12:14:24Z',
      lastOut: '2026-09-17T14:30:09Z',
      now: NOW,
    });
    expect(state.stageLabel).toBe('Invoiced');
    expect(state.orderTotal).toBe(3940);
    expect(state.depositDue).toBe(2315);
    expect(state.dueLabel).toBe('deposit due');
    expect(state.dueNow).toBe(2315);
    expect(state.balance).toBe(3940);
    expect(state.value).toBe(3940);
    expect(state.valueKind).toBe('order');
    expect(state.nextLabel).toBe('Chase deposit');
    expect(state.nextWhy).not.toMatch(/wrote/i);
    expect(state.invoiceId).toBe('321267a4-b963-4c6a-84b4-1210246e6dca');
    expect(isStatusPhrase('Wrote today, waiting on us')).toBe(true);
    expect(isStatusPhrase(state.nextWhy)).toBe(true);
  });

  it('Theresa Grossett and Jade Stoddart: invoice links through orders.invoice_id when invoices.order_id is empty', () => {
    const theresa = personJobState({
      jobId: '2b25bad0-15ac-4738-846c-cafaa257193b',
      jobStage: 'invoiced',
      order: order({ id: '35cb2ac4-06d8-4445-8364-d42583e1ddd5', memorial: 3500, invoiceId: 'b3134d21-7ea2-416b-95d5-2ca4d2809a53' }),
      invoices: [invoice({ id: 'b3134d21-7ea2-416b-95d5-2ca4d2809a53', orderId: null, jobId: '2b25bad0-15ac-4738-846c-cafaa257193b', amount: 3500 })],
      paid: 0,
      now: NOW,
    });
    expect(theresa.invoiceId).toBe('b3134d21-7ea2-416b-95d5-2ca4d2809a53');
    expect(theresa.dueLabel).toBe('deposit due');
    expect(theresa.depositDue).toBe(1750);
    expect(theresa.stageLabel).toBe('Invoiced');

    const jade = personJobState({
      jobId: '2da56fa4-d58b-4981-bc85-fcc23788c260',
      jobStage: 'invoiced',
      order: order({ id: '0f802ce5-f92a-4998-8c16-5d03b7edd256', memorial: 3019.2, invoiceId: '3d643042-cfe1-4326-93a6-5d3ff3ae6437' }),
      invoices: [invoice({ id: '3d643042-cfe1-4326-93a6-5d3ff3ae6437', orderId: null, amount: 3019.2 })],
      paid: 0,
      now: NOW,
    });
    expect(jade.invoiceId).toBe('3d643042-cfe1-4326-93a6-5d3ff3ae6437');
    expect(jade.dueLabel).toBe('deposit due');
    expect(jade.stageLabel).toBe('Invoiced');
  });

  it('Grace Morris #282: order £5,153.60 includes options £328.80; deposit due is £2,719.80', () => {
    const grace = personJobState({
      jobId: '8d5baeee-10be-4931-bb5e-c700302b2b34',
      jobStage: 'invoiced',
      order: order({
        id: '8a61fdb3-8c84-4388-acfa-b8103241ef9f',
        memorial: 4538.8,
        extras: 328.8,
        permit: 286,
        invoiceId: null,
      }),
      invoices: [invoice({ id: '344e7547-988a-4b2a-b4cb-62e1ef7b848c', orderId: '8a61fdb3-8c84-4388-acfa-b8103241ef9f', amount: 2555.4 })],
      paid: 0,
      now: NOW,
    });
    expect(grace.orderTotal).toBe(5153.6);
    expect(grace.depositDue).toBe(2719.8);
    expect(grace.dueNow).toBe(2719.8);
    expect(grace.dueLabel).toBe('deposit due');
    expect(grace.value).toBe(5153.6);
    expect(grace.moneyNote).toMatch(/options £328\.80/);
    expect(grace.moneyNote).toMatch(/permit £286\.00/);
    expect(grace.moneyNote).not.toMatch(/VAT/i);
  });

  it('Jade, Lamasa and Toungporn: a sent quote is Quoted, and Lamasa is the £3,960 total not the £3,550 guide', () => {
    const jade = personJobState({
      jobStage: 'enquired',
      sentQuote: 1890,
      guide: 1890,
      lastIn: '2026-10-14T15:19:37Z',
      lastOut: '2026-10-14T13:22:36Z',
      now: NOW,
    });
    expect(jade.stageLabel).toBe('Quoted');
    expect(jade.value).toBe(1890);
    expect(jade.valueKind).toBe('gmail_quote');
    expect(jade.nextLabel).not.toBe('Send quote');

    const lamasa = personJobState({
      jobStage: 'enquired',
      sentQuote: 3960,
      guide: 3550,
      lastIn: '2026-10-08T11:09:48Z',
      lastOut: '2026-10-08T12:34:45Z',
      now: NOW,
    });
    expect(lamasa.stageLabel).toBe('Quoted');
    expect(lamasa.value).toBe(3960);
    expect(lamasa.valueKind).toBe('gmail_quote');
    expect(lamasa.nextLabel).not.toBe('Send quote');

    const toungporn = personJobState({
      jobStage: 'enquired',
      sentQuote: 4875,
      guide: 4875,
      lastOut: '2026-10-08T10:11:57Z',
      lastIn: '2026-10-03T07:35:35Z',
      now: NOW,
    });
    expect(toungporn.stageLabel).toBe('Quoted');
    expect(toungporn.value).toBe(4875);
    expect(toungporn.nextLabel).not.toBe('Send quote');
  });

  it('Carolyn Bennett-Edge: a deposit date with £0 paid is not deposit paid', () => {
    const carolyn = personJobState({
      jobStage: 'confirmed',
      jobPaidAt: '2026-09-06T13:05:06Z',
      order: order({ id: 'f9ebc5cd-1548-40cb-a0c9-7fda2ce18e61', memorial: 1860.4, depositDate: '2026-09-06' }),
      paid: 0,
      now: NOW,
    });
    expect(carolyn.stageLabel).not.toBe('Deposit paid');
    expect(carolyn.paid).toBe(0);
    expect(carolyn.depositMarkedUnrecorded).toBe(true);
    expect(carolyn.nextLabel).toBe('Record payment');
    expect(carolyn.nextWhy).not.toMatch(/deposit paid/i);
  });

  it('a form guide with no sent quote stays Enquired', () => {
    const guideOnly = personJobState({ jobStage: 'enquired', guide: 5805, lastOut: '2026-10-01T00:00:00Z', now: NOW });
    expect(guideOnly.stageLabel).toBe('Enquired');
    expect(guideOnly.valueKind).toBe('guide');
    expect(guideOnly.nextLabel).toBe('Send quote');
  });
});
