import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { logManagedConnectionEvent } from './whatsappConnectionEvents.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-sync-token',
};

interface SyncBody {
  connection_id?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const syncToken = req.headers.get('x-sync-token');
  const expectedSyncToken = Deno.env.get('WHATSAPP_MANAGED_SYNC_TOKEN');
  if (!expectedSyncToken || syncToken !== expectedSyncToken) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const body = (await req.json().catch(() => ({}))) as SyncBody;
  const now = new Date().toISOString();

  let query = supabase
    .from('whatsapp_managed_connections')
    .select('id, user_id, status')
    .in('status', ['provisioning', 'pending_provider_review', 'pending_meta_action', 'action_required']);

  if (body.connection_id) {
    query = query.eq('id', body.connection_id);
  }

  const { data: rows, error } = await query.limit(50);
  if (error) return jsonResponse({ error: 'Failed to fetch managed connections' }, 500);

  const results: Array<Record<string, unknown>> = [];
  for (const row of rows ?? []) {
    // MVP: keep realistic pending states until external webhook/provider callback updates readiness.
    // This sync updates heartbeat timestamp and records an event, but does not fabricate connected.
    const { error: updateErr } = await supabase
      .from('whatsapp_managed_connections')
      .update({
        last_provider_sync_at: now,
        updated_at: now,
      })
      .eq('id', row.id);

    if (!updateErr) {
      await logManagedConnectionEvent(supabase, {
        managedConnectionId: row.id,
        userId: row.user_id,
        actorType: 'system',
        eventType: 'managed_provider_sync_tick',
        previousStatus: row.status,
        newStatus: row.status,
      });
      results.push({ connection_id: row.id, old_status: row.status, new_status: row.status });
    }
  }

  return jsonResponse({ synced: results.length, results });
});
