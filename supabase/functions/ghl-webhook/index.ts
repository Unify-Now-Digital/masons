import { verifyGhlWebhook } from '../_shared/ghlWebhookVerify.ts';
import { serviceSupabase } from '../_shared/ghlClient.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-ghl-signature, x-wh-signature',
};

const HANDLED_TYPES = new Set([
  'InboundMessage',
  'OutboundMessage',
  'ContactCreate',
  'ContactUpdate',
]);

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractLocationId(payload: Record<string, unknown>): string | null {
  if (payload.locationId != null) return String(payload.locationId);
  const data = payload.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (d.locationId != null) return String(d.locationId);
  }
  return null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return json({ ok: false, error: 'Invalid body' }, 400);
  }

  if (!(await verifyGhlWebhook(rawBody, req))) {
    console.warn('ghl-webhook: signature verification failed');
    return json({ ok: false, error: 'Invalid signature' }, 400);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const type = payload.type != null ? String(payload.type) : '';
  if (type && !HANDLED_TYPES.has(type)) {
    return json({ ok: true, ignored: true });
  }

  const locationId = extractLocationId(payload);
  if (!locationId) {
    return json({ ok: true, skipped: 'no locationId' });
  }

  const supabase = serviceSupabase();
  const { error } = await supabase
    .from('ghl_connections')
    .update({ updated_at: new Date().toISOString() })
    .eq('ghl_location_id', locationId)
    .eq('status', 'active');

  if (error) {
    console.error('ghl-webhook: pulse failed', error.message);
  }

  return json({ ok: true });
});
