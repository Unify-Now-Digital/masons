import { describe, expect, it } from 'vitest';
import { fromConversation, fromOrderPermit, fromOrderProof, fromReceivable, type ReceivableOrderInput, type SalesConversationInput } from './adapters';
import { withUrgency } from './sla';

const NOW = new Date('2026-10-15T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const sales = (o: Partial<SalesConversationInput> = {}): SalesConversationInput => ({
  lane: 'sales', jobId: 'j1', personId: 'p1', conversationId: 'c1', jobStage: 'enquired', jobExitReason: null,
  createdAt: daysAgo(1), lastInboundAt: daysAgo(1), lastOutboundAt: null, name: 'A Customer', orderId: null, orderRef: null,
  value: 1000, valueIsEstimate: true, ...o,
});
const permit = (permitPhase: string | null, o = {}) => fromOrderPermit({
  orderId: 'o1', orderExitReason: null, permitPhase, sentAt: daysAgo(10), submittedAt: daysAgo(20), stageEnteredAt: daysAgo(1),
  createdAt: daysAgo(30), name: 'N', ref: '#1', value: 2000, ...o,
});
const proof = (state: string | null, o = {}) => fromOrderProof({
  orderId: 'o1', orderExitReason: null, state, sentAt: daysAgo(5), changesRequestedAt: daysAgo(1), createdAt: daysAgo(10),
  name: 'N', ref: '#1', value: 2000, ...o,
});
const rec = (o: Partial<ReceivableOrderInput> = {}): ReceivableOrderInput => ({
  kind: 'order', orderId: 'o1', isOpen: true, depositPaid: false, depositUnrecorded: false, depositInvoiced: false,
  balanceDue: false, balanceRequested: false, remainingPence: 218000, since: daysAgo(2), name: 'N', ref: '#1', ...o,
});

describe('A.4 decision table', () => {
  it('sales enquiry, no reply from us → us / reply', () => {
    expect(fromConversation(sales())).toMatchObject({ lane: 'sales', stage: 'enquiry', blockedBy: 'us', verb: 'reply' });
  });
  it('sales enquiry, we replied, no quote → us / quote', () => {
    expect(fromConversation(sales({ lastOutboundAt: daysAgo(0.5) }))).toMatchObject({ stage: 'enquiry', blockedBy: 'us', verb: 'quote' });
  });
  it('sales quoted → them / chase, waiting until the SLA is breached', () => {
    const fresh = fromConversation(sales({ jobStage: 'quoted', lastOutboundAt: daysAgo(1) }))!;
    expect(fresh).toMatchObject({ stage: 'quoted', blockedBy: 'them', verb: 'chase' });
    expect(withUrgency(fresh, NOW).urgency).toBe('waiting');
    const stale = fromConversation(sales({ jobStage: 'quoted', lastOutboundAt: daysAgo(4) }))!;
    expect(withUrgency(stale, NOW).urgency).toBe('overdue');
  });
  it('sales terminal (won / abandoned) → null; dead exits close as abandoned, never lost', () => {
    expect(fromConversation(sales({ jobStage: 'invoiced' }))).toBeNull();
    expect(fromConversation(sales({ jobExitReason: 'lost' }))).toBeNull();
  });
  it('cs family waiting → us / reply (own lane)', () => {
    expect(fromConversation({ lane: 'cs', orderId: 'o1', personId: null, conversationId: null, name: 'N', orderRef: '#1', value: 1, createdAt: daysAgo(9), lastInboundAt: daysAgo(1), lastOutboundAt: daysAgo(2) }))
      .toMatchObject({ id: 'cs:o1', lane: 'cs', verb: 'reply', blockedBy: 'us' });
    expect(fromConversation({ lane: 'cs', orderId: 'o1', personId: null, conversationId: null, name: 'N', orderRef: '#1', value: 1, createdAt: daysAgo(9), lastInboundAt: daysAgo(2), lastOutboundAt: daysAgo(1) })).toBeNull();
  });

  it('permit not_started → us / send_permit', () => {
    expect(permit('form_needed')).toMatchObject({ stage: 'not_started', blockedBy: 'us', verb: 'send_permit' });
  });
  it.each(['with_customer', 'completing'])('permit with_family (%s) → them / chase "Family has the permit form"', (phase) => {
    const i = permit(phase)!;
    expect(i).toMatchObject({ stage: 'with_family', blockedBy: 'them', verb: 'chase', blocker: 'Family has the permit form' });
    expect(withUrgency(i, NOW).urgency).toBe('overdue'); // sent 10d ago > 168h
    expect(withUrgency(permit(phase, { sentAt: daysAgo(2) })!, NOW).urgency).toBe('waiting');
  });
  it('permit submitted → them / chase_council', () => {
    expect(permit('submitted')).toMatchObject({ stage: 'submitted', blockedBy: 'them', verb: 'chase_council' });
  });
  it('permit rejected → us / fix_permit', () => {
    expect(permit('returned_incomplete')).toMatchObject({ stage: 'rejected', blockedBy: 'us', verb: 'fix_permit' });
  });
  it('permit approved / exited order → null', () => {
    expect(permit('approved')).toBeNull();
    expect(permit('form_needed', { orderExitReason: 'cancelled' })).toBeNull();
  });

  it.each(['not_started', 'draft'])('proof %s → us / send_proof', (state) => {
    expect(proof(state)).toMatchObject({ blockedBy: 'us', verb: 'send_proof' });
  });
  it('proof sent → them / chase_proof', () => {
    expect(proof('sent')).toMatchObject({ stage: 'sent', blockedBy: 'them', verb: 'chase_proof' });
  });
  it('proof changes_requested → us / revise_proof', () => {
    expect(proof('changes_requested')).toMatchObject({ stage: 'changes_requested', blockedBy: 'us', verb: 'revise_proof' });
  });
  it('proof falls back to orders.proof_status only when order_proofs.state is null', () => {
    expect(proof(null, { proofStatus: 'Revision' })).toMatchObject({ verb: 'revise_proof' });
    expect(proof(null, { proofStatus: 'Approved' })).toBeNull();
    expect(proof('sent', { proofStatus: 'Revision' })).toMatchObject({ verb: 'chase_proof' });
  });

  it('payment not_invoiced → us / request_deposit', () => {
    expect(fromReceivable(rec(), NOW)).toMatchObject({ stage: 'not_invoiced', blockedBy: 'us', verb: 'request_deposit', value: 2180 });
  });
  it('payment deposit_due → them / request_deposit', () => {
    expect(fromReceivable(rec({ depositInvoiced: true }), NOW)).toMatchObject({ stage: 'deposit_due', blockedBy: 'them', verb: 'request_deposit' });
  });
  it('payment balance_due → them / request_balance once requested, us before', () => {
    expect(fromReceivable(rec({ depositPaid: true, balanceDue: true, balanceRequested: true }), NOW)).toMatchObject({ stage: 'balance_due', blockedBy: 'them', verb: 'request_balance' });
    expect(fromReceivable(rec({ depositPaid: true, balanceDue: true }), NOW)).toMatchObject({ stage: 'balance_due', blockedBy: 'us', verb: 'request_balance' });
  });
  it('payment deposit date set but unrecorded → us / record_payment', () => {
    expect(fromReceivable(rec({ depositUnrecorded: true }), NOW)).toMatchObject({ blockedBy: 'us', verb: 'record_payment' });
  });
  it('payment unmatched bank line → us / reconcile, no stage clock', () => {
    const i = fromReceivable({ kind: 'unmatched_payment', paymentId: 'x', amountPounds: 50, receivedAt: daysAgo(30), reference: 'REF', source: 'revolut' }, NOW)!;
    expect(i).toMatchObject({ lane: 'payment', blockedBy: 'us', verb: 'reconcile' });
    expect(withUrgency(i, NOW)).toMatchObject({ dueAt: null, urgency: 'ok' });
  });
  it('payment paid / resting / closed → null', () => {
    expect(fromReceivable(rec({ remainingPence: 0 }), NOW)).toBeNull();
    expect(fromReceivable(rec({ depositPaid: true }), NOW)).toBeNull();
    expect(fromReceivable(rec({ isOpen: false }), NOW)).toBeNull();
  });
});
