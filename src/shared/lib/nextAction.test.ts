import { describe, expect, it } from 'vitest';
import {
  findOpenDuplicateJobs, needsUs, nextActionForEnquiry, nextActionForOrder, replyTimerText,
} from './nextAction';

const NOW = new Date('2026-10-14T10:00:00Z');
const paid = {
  jobPaidAt: '2026-10-10', permitStatus: 'approved', proofStatus: 'Approved', stoneStatus: 'In Stock',
  inscriptionText: 'In loving memory',
};

describe('nextActionForOrder', () => {
  it('asks for a deposit first when nothing is paid (wayfinding: Ali Hazrati)', () => {
    const a = nextActionForOrder({ stoneStatus: 'In Stock', permitStatus: 'approved' }, NOW);
    expect(a.kind).toBe('deposit');
    expect(a.label).toBe('Request deposit');
    expect(a.tone).toBe('red');
  });
  it('deposit_date also counts as paid', () => {
    expect(nextActionForOrder({ ...paid, jobPaidAt: null, depositDate: '2026-10-01' }, NOW).kind).toBe('none');
  });
  it('never suggests permit or proof steps (removed Oct 2026)', () => {
    for (const permitStatus of ['not_started', 'customer_completed', 'form_sent', 'pending', null]) {
      for (const proofStatus of ['Received', 'Revision', 'In_Progress', 'Not_Received', 'Sent']) {
        expect(nextActionForOrder({ ...paid, permitStatus, proofStatus }, NOW).kind).toBe('none');
      }
    }
  });
  it('balance only when ready, unpaid and install within 21 days', () => {
    expect(nextActionForOrder({ ...paid, installationDate: '2026-10-20' }, NOW)).toMatchObject({ kind: 'balance', tone: 'red' });
    expect(nextActionForOrder({ ...paid, installationDate: '2026-10-30' }, NOW)).toMatchObject({ kind: 'balance', tone: 'amber' });
    expect(nextActionForOrder({ ...paid, installationDate: '2026-12-30' }, NOW).kind).toBe('none');
    expect(nextActionForOrder({ ...paid, installationDate: '2026-10-20', secondPaymentDate: '2026-10-12' }, NOW).kind).toBe('none');
    expect(nextActionForOrder({ ...paid, stoneStatus: 'Ordered', installationDate: '2026-10-20' }, NOW).kind).toBe('none');
    expect(nextActionForOrder({ ...paid }, NOW).kind).toBe('none');
  });
  it('never offers balance with no deposit (audit #8 contradiction)', () => {
    expect(nextActionForOrder({ ...paid, jobPaidAt: null, installationDate: '2026-10-20' }, NOW).kind).toBe('deposit');
  });
  it('asks for the inscription when the proof is open and the text is empty, without outranking stone', () => {
    expect(nextActionForOrder({
      ...paid, stoneStatus: 'NA', proofStatus: 'Received', inscriptionText: '',
    }, NOW)).toMatchObject({ kind: 'stone' });
    expect(nextActionForOrder({
      ...paid, proofStatus: 'Received', inscriptionText: '   ',
    }, NOW)).toMatchObject({ kind: 'inscription', label: 'Get inscription', reason: 'Proof blocked: no inscription', tone: 'amber' });
    expect(nextActionForOrder({
      ...paid, proofStatus: 'Approved', inscriptionText: '',
    }, NOW).kind).toBe('none');
    expect(nextActionForOrder({
      ...paid, proofStatus: 'Received', inscriptionText: 'Beloved',
    }, NOW).kind).toBe('none');
    expect(nextActionForOrder({
      ...paid, proofStatus: 'Received', inscriptionText: undefined,
    }, NOW).kind).toBe('none');
  });
  it('Carolyn Bennett-Edge: a deposit date with £0 paid is not deposit paid', () => {
    const a = nextActionForOrder({
      jobStage: 'confirmed', depositDate: '2026-09-06', jobPaidAt: '2026-09-06', amountPaid: 0, stoneStatus: 'NA',
    }, NOW);
    expect(a.kind).toBe('deposit');
    expect(a.reason).toMatch(/no amount recorded/);
    expect(a.reason).not.toMatch(/deposit paid/i);
  });
  it('says the deposit was paid, in days, and is overdue only after 21 days', () => {
    expect(nextActionForOrder({
      ...paid, stoneStatus: 'NA', depositDate: '2026-10-14', jobPaidAt: '2026-10-14',
    }, NOW).reason).toBe('Deposit paid today');
    expect(nextActionForOrder({
      ...paid, stoneStatus: 'NA', depositDate: '2026-10-01',
    }, NOW)).toMatchObject({ reason: 'Deposit paid 13 days ago', tone: 'amber' });
    expect(nextActionForOrder({
      ...paid, stoneStatus: 'NA', depositDate: '2026-09-01',
    }, NOW).tone).toBe('red');
  });
  it('nothing for exited or complete jobs', () => {
    expect(nextActionForOrder({ jobExitReason: 'cancelled' }, NOW).kind).toBe('none');
    expect(nextActionForOrder({ jobStage: 'complete' }, NOW).kind).toBe('none');
  });
});

describe('nextActionForEnquiry', () => {
  it('follow up on our turn, coloured by aging', () => {
    expect(nextActionForEnquiry({ side: 'us', agingLevel: 'red' })).toMatchObject({ kind: 'follow', tone: 'red' });
    expect(nextActionForEnquiry({ side: 'us', agingLevel: 'fresh' }).tone).toBe('neutral');
  });
  it('waiting on their turn; none when unknown', () => {
    expect(nextActionForEnquiry({ side: 'them' })).toMatchObject({ kind: 'waiting', waitingOn: 'customer' });
    expect(nextActionForEnquiry({ side: null }).kind).toBe('none');
  });
  it('create order only when a quote is known accepted', () => {
    expect(nextActionForEnquiry({ side: 'us', jobStage: 'quoted', quoteAccepted: true }).kind).toBe('order');
    expect(nextActionForEnquiry({ side: 'us', jobStage: 'quoted' }).kind).toBe('follow');
  });
  it('needsUs', () => {
    expect(needsUs(nextActionForEnquiry({ side: 'us' }))).toBe(true);
    expect(needsUs(nextActionForEnquiry({ side: 'them' }))).toBe(false);
  });
});

describe('replyTimerText', () => {
  const H = 3_600_000;
  it('overdue / due in / waiting', () => {
    expect(replyTimerText('us', 52 * H, 4 * H)).toEqual({ text: 'Overdue · 2d', tone: 'over' });
    expect(replyTimerText('us', 1 * H, 4 * H)).toEqual({ text: 'Due in 3h', tone: 'neutral' });
    expect(replyTimerText('us', 3 * H, 4 * H)).toEqual({ text: 'Due in 1h', tone: 'soon' });
    expect(replyTimerText('them', 2 * H, 4 * H)).toEqual({ text: 'Waiting · 2h', tone: 'neutral' });
  });
});

describe('findOpenDuplicateJobs', () => {
  it('ignores exited and complete jobs', () => {
    const jobs = [
      { id: '1', stage: 'enquired' },
      { id: '2', stage: 'complete' },
      { id: '3', stage: 'quoted', exit_reason: 'lost' },
    ];
    expect(findOpenDuplicateJobs(jobs).map((j) => j.id)).toEqual(['1']);
  });
});
