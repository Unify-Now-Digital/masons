import { assertEquals } from 'jsr:@std/assert@1';
import { mapRevolutTransaction, mapStripeCharge, mapStripeDispute, mapStripeRefund, poundsToPence, revolutSignature, verifyRevolutSignature } from './ledger.ts';

// Public test vector from Revolut's Business API webhook docs (sample secret, not a real key).
const DOC_SECRET = 'wsk_r59a4HfWVAKycbCaNO1RvgCJec02gRd8';
const DOC_TS = '1683650202360';
const DOC_BODY = '{"data":{"id":"645a7696-22f3-aa47-9c74-cbae0449cc46","new_state":"completed","old_state":"pending","request_id":"app_charges-9f5d5eb3-1e06-46c5-b1c0-3914763e0bcb"},"event":"TransactionStateChanged","timestamp":"2023-05-09T16:36:38.028960Z"}';
const DOC_SIG = 'v1=bca326fb378d0da7f7c490ad584a8106bab9723d8d9cdd0d50b4c5b3be3837c0';

Deno.test('revolut signature matches the docs vector', async () => {
  assertEquals(await revolutSignature(DOC_SECRET, DOC_TS, DOC_BODY), DOC_SIG);
});
Deno.test('revolut verify: accepts rotated header list, rejects tamper/stale', async () => {
  const now = Number(DOC_TS) + 1000;
  assertEquals((await verifyRevolutSignature({ secret: DOC_SECRET, timestamp: DOC_TS, signatureHeader: `v1=00,${DOC_SIG}`, rawBody: DOC_BODY, now })).ok, true);
  assertEquals((await verifyRevolutSignature({ secret: DOC_SECRET, timestamp: DOC_TS, signatureHeader: DOC_SIG, rawBody: DOC_BODY + ' ', now })).ok, false);
  assertEquals((await verifyRevolutSignature({ secret: DOC_SECRET, timestamp: DOC_TS, signatureHeader: DOC_SIG, rawBody: DOC_BODY, now: now + 10 * 60_000 })).reason, 'stale timestamp');
});
Deno.test('pounds to pence has no float drift', () => {
  assertEquals(poundsToPence(500.01), 50001);
  assertEquals(poundsToPence(0.29), 29);
  assertEquals(poundsToPence(1250.5), 125050);
});
Deno.test('revolut mapping: incoming only, payer from counterparty', () => {
  const t = { id: 't1', state: 'completed', reference: 'OR-123', created_at: '2026-10-01T10:00:00Z', legs: [{ amount: 200, currency: 'GBP', counterparty: { name: 'Jane Doyle' } }] };
  const m = mapRevolutTransaction('org', t)!;
  assertEquals([m.gross_pence, m.payer_name, m.state, m.currency], [20000, 'Jane Doyle', 'completed', 'gbp']);
  assertEquals(mapRevolutTransaction('org', { ...t, legs: [{ amount: -5 }] }), null);
  assertEquals(mapRevolutTransaction('org', { ...t, state: 'reverted' })!.state, 'reverted');
});
Deno.test('stripe mapping: keyed on charge, fee from balance txn, refunds negative', () => {
  const c = mapStripeCharge('org', { id: 'ch_1', amount: 75000, currency: 'gbp', created: 1760000000, status: 'succeeded', payment_intent: 'pi_1', balance_transaction: { fee: 1150 } }, { stripeInvoiceId: 'in_1' });
  assertEquals([c.external_id, c.gross_pence, c.fee_pence, c.stripe_payment_intent_id, c.stripe_invoice_id], ['ch_1', 75000, 1150, 'pi_1', 'in_1']);
  const r = mapStripeRefund('org', { id: 're_1', amount: 1000, currency: 'gbp', created: 1760000000, status: 'succeeded', charge: 'ch_1' });
  assertEquals([r.kind, r.gross_pence, r.parent_external_id], ['refund', -1000, 'ch_1']);
});
Deno.test('stripe disputes: chargeback negative, won dispute is a separate positive reversal', () => {
  const base = { id: 'dp_1', amount: 5000, currency: 'gbp', created: 1760000000, charge: 'ch_1' };
  const open = mapStripeDispute('org', { ...base, status: 'needs_response' });
  const won = mapStripeDispute('org', { ...base, status: 'won' });
  assertEquals([open.kind, open.gross_pence, open.external_id], ['chargeback', -5000, 'dp_1']);
  assertEquals([won.kind, won.gross_pence, won.external_id], ['chargeback_reversal', 5000, 'dp_1:reversal']);
});
