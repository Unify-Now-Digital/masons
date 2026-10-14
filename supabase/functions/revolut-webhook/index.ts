import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { mapRevolutTransaction, revolutState, verifyRevolutSignature, type RevolutTransaction } from '../_shared/ledger.ts';

// Revolut Business webhook → unified payments ledger (public.ledger_ingest_payment).
// Signature: HMAC-SHA256 over `v1.{Revolut-Request-Timestamp}.{raw body}` (see _shared/ledger.ts).
// The signing secret and access tokens are read server-side only (service role); never returned.

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

interface WebhookPayload {
  event: string;
  timestamp?: string;
  data: RevolutTransaction & { new_state?: string; old_state?: string };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const rawBody = await req.text().catch(() => null);
  if (rawBody == null) return json({ error: 'Invalid body' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server configuration error' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // One webhook URL per connection: ?connection=<revolut_connections.id>. Falls back to the
  // single active connection for older setups.
  const connectionId = new URL(req.url).searchParams.get('connection');
  let q = supabase.from('revolut_connections').select('id, organization_id, webhook_signing_secret').eq('status', 'active');
  if (connectionId) q = q.eq('id', connectionId);
  const { data: conns, error: connErr } = await q.limit(2);
  if (connErr || !conns?.length || (!connectionId && conns.length > 1)) {
    console.error('revolut-webhook: no unique active connection');
    return json({ error: 'Webhook not configured' }, 500);
  }
  const conn = conns[0];

  const verdict = await verifyRevolutSignature({
    secret: conn.webhook_signing_secret ?? '',
    timestamp: req.headers.get('revolut-request-timestamp'),
    signatureHeader: req.headers.get('revolut-signature'),
    rawBody,
  });
  if (!verdict.ok) {
    console.error('revolut-webhook: rejected', verdict.reason);
    return json({ error: 'Invalid signature' }, 401);
  }

  let payload: WebhookPayload;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const raw = payload as unknown;

  if (payload.event === 'TransactionCreated') {
    const row = mapRevolutTransaction(conn.organization_id, payload.data, raw);
    if (!row) return json({ received: true, skipped: 'not incoming' });
    const { error } = await supabase.rpc('ledger_ingest_payment', { p: row });
    if (error) { console.error('revolut-webhook ingest failed', error.code); return json({ error: 'ingest failed' }, 500); }
    return json({ received: true });
  }

  if (payload.event === 'TransactionStateChanged') {
    // State-only event: update the existing ledger row's state (ingest is an idempotent upsert).
    const state = revolutState(payload.data.new_state ?? payload.data.state);
    const { error } = await supabase.rpc('ledger_set_state', {
      p_org: conn.organization_id, p_source: 'revolut', p_external_id: payload.data.id, p_state: state, p_raw: raw,
    });
    if (error) { console.error('revolut-webhook state change failed', error.code); return json({ error: 'state change failed' }, 500); }
    return json({ received: true });
  }

  return json({ received: true });
});
