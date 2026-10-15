import { verifyRevolutWebhookSignature } from '../_shared/revolut/webhookSignature.ts';
import type { RevolutTransaction } from '../_shared/revolut/transaction.ts';
import {
  accessTokenFor,
  adminClient,
  applyRevolutTransaction,
  fetchTransaction,
  isRevolutEnv,
  json,
  loadActiveConnections,
  loadOpenOrders,
  readRevolutEnv,
  type ConnectionRow,
} from '../_shared/revolutRuntime.ts';
import { logActivityEvent } from '../_shared/activityEvent.ts';

interface CreatedEvent {
  event?: string;
  data?: RevolutTransaction & { new_state?: string; old_state?: string };
}

const TERMINAL = new Set(['declined', 'failed', 'reverted']);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let raw = '';
  try {
    raw = await req.text();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }
  const timestamp = req.headers.get('revolut-request-timestamp');
  const signature = req.headers.get('revolut-signature');
  if (!timestamp || !signature) return json({ error: 'Missing signature' }, 401);

  const supabase = adminClient();
  if (!supabase) return json({ error: 'Server configuration error' }, 500);
  const connections = await loadActiveConnections(supabase);
  let connection: ConnectionRow | null = null;
  for (const candidate of connections) {
    if (!candidate.webhook_signing_secret) continue;
    const valid = await verifyRevolutWebhookSignature(raw, timestamp, signature, candidate.webhook_signing_secret);
    if (valid) {
      connection = candidate;
      break;
    }
  }
  if (!connection) return json({ error: 'Invalid signature' }, 401);

  let payload: CreatedEvent;
  try {
    payload = JSON.parse(raw) as CreatedEvent;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const event = payload.event ?? '';
  const data = payload.data;
  if (!data?.id) return json({ received: true });

  const env = readRevolutEnv();
  if (!isRevolutEnv(env)) return json({ error: 'Server configuration error' }, 500);

  try {
    if (event === 'TransactionStateChanged' && data.new_state && TERMINAL.has(data.new_state)) {
      const { data: existing } = await supabase
        .from('order_payments')
        .select('id, matched_by')
        .eq('external_id', data.id)
        .eq('organization_id', connection.organization_id)
        .maybeSingle();
      if (existing) {
        await supabase.from('order_payments').update({
          provider_state: data.new_state,
          status: 'dismissed',
          matched_by: existing.matched_by || 'auto',
          match_reason: `Revolut ${data.new_state}`,
        }).eq('id', existing.id);
        await logActivityEvent(supabase, {
          organizationId: connection.organization_id,
          type: 'payment.reversed',
          category: 'finance',
          priority: 'action',
          title: 'Payment reversed',
          actorType: 'revolut',
          entityType: 'payment',
          entityId: existing.id,
          dedupeKey: `revolut:reversed:${data.id}`,
        });
        return json({ received: true });
      }
    }

    const access = await accessTokenFor(supabase, env, connection);
    if (!access.ok) return json({ error: 'Could not read Revolut' }, 500);
    const txn = event === 'TransactionCreated' && data.legs
      ? data
      : await fetchTransaction(access.api, access.accessToken, data.id);
    if (!txn) return json({ error: 'Transaction not available' }, 500);
    if (data.new_state && !txn.state) txn.state = data.new_state;
    const orders = await loadOpenOrders(supabase, connection.organization_id);
    let counterpartyName: string | null = null;
    const legId = txn.legs?.find((leg) => leg.counterparty?.id)?.counterparty?.id;
    if (legId) {
      const res = await fetch(`${access.api}/api/1.0/counterparty/${legId}`, {
        headers: { Authorization: `Bearer ${access.accessToken}` },
      });
      if (res.ok) {
        const body = await res.json() as { name?: string };
        counterpartyName = body.name?.trim() || null;
      }
    }
    await applyRevolutTransaction(supabase, {
      organizationId: connection.organization_id,
      userId: connection.user_id,
      txn,
      orders,
      counterpartyName,
    });
    return json({ received: true });
  } catch (err) {
    console.error('revolut webhook', err instanceof Error ? err.message : 'failed');
    return json({ error: 'Failed to record payment' }, 500);
  }
});
