import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { revolutTimestampFresh, verifyRevolutWebhookSignature } from '../../../../supabase/functions/_shared/revolut/webhookSignature';

const SECRET = 'wsk_r59a4HfWVAKycbCaNO1RvgCJec02gRd8';
const TIMESTAMP = '1683650202360';
const RAW = '{"data":{"id":"645a7696-22f3-aa47-9c74-cbae0449cc46","new_state":"completed","old_state":"pending","request_id":"app_charges-9f5d5eb3-1e06-46c5-b1c0-3914763e0bcb"},"event":"TransactionStateChanged","timestamp":"2023-05-09T16:36:38.028960Z"}';
const OFFICIAL = 'v1=bca326fb378d0da7f7c490ad584a8106bab9723d8d9cdd0d50b4c5b3be3837c0';
const NOW = 1_683_650_202_360;

describe('Revolut webhook signature', () => {
  it('matches the published v1 test vector', async () => {
    const nodeHex = createHmac('sha256', SECRET).update(`v1.${TIMESTAMP}.${RAW}`).digest('hex');
    expect(`v1=${nodeHex}`).toBe(OFFICIAL);
    await expect(verifyRevolutWebhookSignature(RAW, TIMESTAMP, OFFICIAL, SECRET, NOW)).resolves.toBe(true);
  });

  it('accepts one of several signatures during a secret rotation', async () => {
    const header = `v1=${'ab'.repeat(32)},${OFFICIAL}`;
    await expect(verifyRevolutWebhookSignature(RAW, TIMESTAMP, header, SECRET, NOW)).resolves.toBe(true);
  });

  it('rejects a wrong secret, a changed body, a stale timestamp, and a missing header', async () => {
    await expect(verifyRevolutWebhookSignature(RAW, TIMESTAMP, OFFICIAL, 'other-secret', NOW)).resolves.toBe(false);
    await expect(verifyRevolutWebhookSignature(`${RAW} `, TIMESTAMP, OFFICIAL, SECRET, NOW)).resolves.toBe(false);
    await expect(verifyRevolutWebhookSignature(RAW, TIMESTAMP, OFFICIAL, SECRET, NOW + 6 * 60 * 1000)).resolves.toBe(false);
    await expect(verifyRevolutWebhookSignature(RAW, TIMESTAMP, '', SECRET, NOW)).resolves.toBe(false);
    expect(revolutTimestampFresh('2023-05-09T16:36:38.028960Z', NOW)).toBe(false);
  });
});
