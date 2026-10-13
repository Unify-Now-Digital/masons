import { describe, expect, it } from 'vitest';
import { conversationStatusLine, moneyCards, newJobConfirmCopy, progressTrack, type PanelOrderInput } from './orderPanel';

const base: PanelOrderInput = {
  stoneStatus: 'NA', permitStatus: 'not_started', proofStatus: 'Received', installationDate: null,
  depositDate: null, jobPaidAt: null, secondPaymentDate: null, total: 2370.4, amountPaid: null,
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
  it('deposit paid from invoice amount, balance = total − paid', () => {
    const m = moneyCards({ ...base, depositDate: '2026-10-10', amountPaid: 1500 });
    expect(m.deposit).toMatchObject({ label: 'Deposit paid', amount: 1500, tone: 'green' });
    expect(m.balance).toMatchObject({ label: 'Balance', amount: 870.4, sub: 'on completion' });
  });
  it('no payment: no invented figures', () => {
    const m = moneyCards(base);
    expect(m.deposit).toMatchObject({ label: 'Deposit due', amount: null, sub: 'no invoice yet' });
    expect(m.balance.amount).toBeNull();
    expect(moneyCards({ ...base, amountPaid: 0 }).deposit.sub).toBe('on invoice · not paid');
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
