import { describe, expect, it } from 'vitest';
import { conversationStatusLine, moneyCards, orderInvoicePence, newJobConfirmCopy, progressTrack, type PanelOrderInput } from './orderPanel';

const base: PanelOrderInput = {
  stoneStatus: 'NA', permitStatus: 'not_started', proofStatus: 'Received', installationDate: null,
  depositDate: null, jobPaidAt: null, secondPaymentDate: null, total: 2370.4, amountPaidPence: null, remainingPence: null,
};
const NOW = new Date('2026-10-14T10:00:00Z');

describe('progressTrack', () => {
  it('uses honest words and five steps', () => {
    const t = progressTrack(base, NOW);
    expect(t.map((s) => s.stage)).toEqual(['Stone', 'Permit', 'Proof', 'Lettering', 'Install']);
    expect(t.map((s) => s.word)).toEqual(['Not ordered', 'Not started', 'Received', 'Unknown', 'No date']);
    expect(t[1]!.state).toBe('todo'); // no deposit yet → not blocked on us
    expect(t[2]!.state).toBe('blocked');
    expect(t[3]!.state).toBe('unknown');
  });
  it('permit not started after deposit is blocked on us; install date shows', () => {
    const t = progressTrack({ ...base, depositDate: '2026-10-10', installationDate: '2026-11-02' }, NOW);
    expect(t[1]!.state).toBe('blocked');
    expect(t[4]).toMatchObject({ state: 'progress', word: '2 Nov' });
  });
});

describe('moneyCards', () => {
  it('pence-sized fixtures: £120 deposit reads £120 (not £12,000); balance from the invoice remaining', () => {
    // Real invoice row: amount £2,370.40 (pounds), amount_paid 12000p, amount_remaining 225040p.
    const inv = orderInvoicePence({ amount: 2370.4, amount_paid: 12000, amount_remaining: 225040, status: 'partially_paid' });
    expect(inv).toEqual({ amountPaidPence: 12000, remainingPence: 225040 });
    const m = moneyCards({ ...base, depositDate: '2026-10-10', total: 2500, ...inv });
    expect(m.deposit).toMatchObject({ label: 'Deposit paid', amount: 120, tone: 'green' });
    // Order total (2500) differs from invoice → balance still comes from the invoice.
    expect(m.balance).toMatchObject({ label: 'Balance', amount: 2250.4, sub: 'on completion · from invoice' });
  });
  it('remaining falls back to invoice amount − paid (pence) when amount_remaining is missing; paid invoice → 0', () => {
    expect(orderInvoicePence({ amount: '300.00', amount_paid: '5050', amount_remaining: null })).toEqual({ amountPaidPence: 5050, remainingPence: 24950 });
    expect(orderInvoicePence({ amount: 300, amount_paid: 0, amount_remaining: 30000, status: 'paid' }).remainingPence).toBe(0);
    expect(orderInvoicePence(null)).toEqual({ amountPaidPence: null, remainingPence: null });
  });
  it('no payment: deposit due by the SM rule (50% memorial + 100% permit), no balance figure', () => {
    const m = moneyCards({ ...base, total: 4602.2, permit: 376 });
    expect(m.deposit).toMatchObject({ label: 'Deposit due', amount: 2489.1, sub: '50% + permit · no invoice yet' });
    expect(m.balance.amount).toBeNull();
    expect(moneyCards({ ...base, amountPaidPence: 0 }).deposit.sub).toBe('50% + permit · not paid');
    expect(moneyCards({ ...base, total: 0 }).deposit.amount).toBeNull();
  });
  it('balance paid when second payment recorded', () => {
    expect(moneyCards({ ...base, depositDate: '2026-01-01', secondPaymentDate: '2026-09-01' }).balance.label).toBe('Balance paid');
  });
});

describe('conversationStatusLine', () => {
  it('one quiet status', () => {
    expect(conversationStatusLine({ linked: false, jobStage: null, hasInvoice: false, depositPaid: false })).toBe('Not linked to a customer');
    expect(conversationStatusLine({ linked: true, jobStage: null, hasInvoice: false, depositPaid: false })).toBe('No job yet');
    expect(conversationStatusLine({ linked: true, jobStage: 'quoted', hasInvoice: true, depositPaid: false })).toBe('Invoice sent, deposit not paid');
    expect(conversationStatusLine({ linked: true, jobStage: 'invoiced', hasInvoice: true, depositPaid: true })).toBe('Deposit paid');
    expect(conversationStatusLine({ linked: true, jobStage: 'enquired', hasInvoice: false, depositPaid: false })).toBe('Enquiry, not quoted');
  });
});

describe('newJobConfirmCopy', () => {
  it('names the existing order (duplicate check)', () => {
    const c = newJobConfirmCopy('Sharena', [{ orderRef: 'ORD-000280', description: 'The Knebworth, invoice sent' }]);
    expect(c.title).toBe('Start a new job for Sharena?');
    expect(c.body).toBe(
      'Sharena already has ORD-000280 (The Knebworth, invoice sent). Start a new job only for a different memorial. Messages stay linked to ORD-000280.',
    );
  });
  it('counts extra open jobs', () => {
    expect(newJobConfirmCopy('Jo', [{ orderRef: null, description: 'Quoted' }, { orderRef: null, description: null }]).body).toContain('and 1 more open job.');
  });
});

describe('review fixes', () => {
  it('install today is in progress (not done at 00:00 UTC); yesterday is done', () => {
    const now = new Date(2026, 9, 14, 9, 0);
    expect(progressTrack({ ...base, installationDate: '2026-10-14' }, now)[4]!.state).toBe('progress');
    expect(progressTrack({ ...base, installationDate: '2026-10-13' }, now)[4]!.state).toBe('done');
  });
  it('duplicate-check copy reads well with no first name', () => {
    const c = newJobConfirmCopy('', [{ orderRef: 'ORD-000123', description: null }]);
    expect(c.body.startsWith('This customer already has ORD-000123.')).toBe(true);
  });
});
