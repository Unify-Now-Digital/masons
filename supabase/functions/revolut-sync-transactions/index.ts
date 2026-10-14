import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { mapRevolutTransaction, type RevolutTransaction } from '../_shared/ledger.ts';
import { getUserFromRequest } from '../_shared/auth.ts';

// Pull the last 30 days of Revolut transfers into the unified ledger. Idempotent: the
// ledger upserts on (organization, source, external_id); matching happens in the DB.
// Callable by finance users of the org (JWT) — the Revolut token never leaves the server.

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};
const json = (b: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server configuration error' }, 500);

    const { organization_id: orgId } = (await req.json().catch(() => ({}))) as { organization_id?: string };
    if (!orgId) return json({ error: 'organization_id required' }, 400);

    // Caller must be a finance user of that org (checked with their own JWT through RLS-safe RPC).
    const user = await getUserFromRequest(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    });
    const { data: allowed } = await asUser.rpc('user_can_view_org_finance', { p_org: orgId });
    if (allowed !== true) return json({ error: 'Forbidden' }, 403);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: connection, error: connErr } = await supabase
      .from('revolut_connections').select('id, access_token').eq('status', 'active').eq('organization_id', orgId).maybeSingle();
    if (connErr || !connection) return json({ error: 'No active Revolut connection' }, 404);

    const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const res = await fetch(`https://b2b.revolut.com/api/1.0/transactions?from=${from}&type=transfer`, {
      headers: { Authorization: `Bearer ${connection.access_token}` },
    });
    if (!res.ok) { console.error('revolut-sync: fetch failed', res.status); return json({ error: 'Failed to fetch transactions' }, 502); }

    const txns = (await res.json()) as RevolutTransaction[];
    let ingested = 0;
    for (const t of txns) {
      const row = mapRevolutTransaction(orgId, t);
      if (!row) continue;
      const { error } = await supabase.rpc('ledger_ingest_payment', { p: row });
      if (error) { console.error('revolut-sync: ingest failed', t.id, error.code); continue; }
      ingested++;
    }
    return json({ ingested });
  } catch (err) {
    console.error('revolut-sync-transactions error', err);
    return json({ error: 'Unexpected error' }, 500);
  }
});
