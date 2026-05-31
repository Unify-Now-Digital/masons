// Multi-org: GHL workflow Custom Webhook → pulse ghl_connections.updated_at by location.id.
// Auth: shared secret header (not platform Ed25519 signatures).
import { serviceSupabase } from '../_shared/ghlClient.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-webhook-secret',
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function secretsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function getWebhookSecretHeader(req: Request): string | null {
  return req.headers.get('X-Webhook-Secret') ?? req.headers.get('x-webhook-secret');
}

function extractLocationId(payload: Record<string, unknown>): string | null {
  const location = payload.location;
  if (location && typeof location === 'object' && !Array.isArray(location)) {
    const loc = location as Record<string, unknown>;
    if (loc.id != null) return String(loc.id);
  }
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

  const expectedSecret = Deno.env.get('GHL_WORKFLOW_WEBHOOK_SECRET')?.trim();
  if (!expectedSecret) {
    console.error('ghl-webhook: GHL_WORKFLOW_WEBHOOK_SECRET is not configured');
    return json({ ok: false, error: 'Webhook secret not configured' }, 500);
  }

  const providedSecret = getWebhookSecretHeader(req)?.trim();
  if (!providedSecret || !secretsEqual(providedSecret, expectedSecret)) {
    console.warn('ghl-webhook: invalid or missing X-Webhook-Secret');
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return json({ ok: false, error: 'Invalid body' }, 400);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
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
