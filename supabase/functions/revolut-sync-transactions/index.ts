import {
  adminClient,
  corsHeaders,
  isFinanceMember,
  isRevolutEnv,
  isUnattended,
  json,
  loadActiveConnection,
  loadActiveConnections,
  readRevolutEnv,
  requester,
  syncConnection,
} from '../_shared/revolutRuntime.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const env = readRevolutEnv();
  if (!isRevolutEnv(env)) return json({ error: 'Revolut is not configured' }, 500);
  const supabase = adminClient();
  if (!supabase) return json({ error: 'Revolut is not configured' }, 500);

  let organizationId = '';
  try {
    const body = await req.json() as { organization_id?: string };
    organizationId = (body.organization_id ?? '').trim();
  } catch {
    organizationId = '';
  }

  const unattended = isUnattended(req);
  if (!unattended) {
    const user = await requester(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!organizationId) return json({ error: 'organisation_id is required' }, 400);
    if (!await isFinanceMember(supabase, user.id, organizationId)) return json({ error: 'Forbidden' }, 403);
  }

  try {
    const connections = organizationId
      ? [await loadActiveConnection(supabase, organizationId)].filter((row) => row && row.status === 'active')
      : await loadActiveConnections(supabase);
    if (!connections.length) return json({ error: 'No active Revolut connection' }, 404);
    let inserted = 0;
    let updated = 0;
    for (const connection of connections) {
      if (!connection) continue;
      const result = await syncConnection(supabase, env, connection);
      inserted += result.inserted;
      updated += result.updated;
    }
    return json({ synced: inserted, updated });
  } catch (err) {
    const pg = err as { code?: string; message?: string } | null;
    const code = err instanceof Error ? err.message : (pg?.code ? `db_${pg.code}` : 'sync_failed');
    console.error('revolut sync', code, pg?.message ?? '');
    if (organizationId) {
      await supabase.from('revolut_connections').update({
        last_sync_error: code.slice(0, 120),
        updated_at: new Date().toISOString(),
      }).eq('organization_id', organizationId);
    }
    const status = code === 'refresh_expired' ? 401 : 500;
    return json({ error: code === 'refresh_expired' ? 'Revolut needs connecting again' : 'Sync failed' }, status);
  }
});
