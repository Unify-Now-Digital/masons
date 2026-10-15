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
  refreshConnectionToken,
  requester,
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

  if (!isUnattended(req)) {
    const user = await requester(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!organizationId) return json({ error: 'organisation_id is required' }, 400);
    if (!await isFinanceMember(supabase, user.id, organizationId)) return json({ error: 'Forbidden' }, 403);
  }

  const connections = organizationId
    ? [await loadActiveConnection(supabase, organizationId)].filter((row) => !!row)
    : await loadActiveConnections(supabase);
  if (!connections.length) return json({ error: 'No Revolut connection' }, 404);

  let refreshed = 0;
  let failed = 0;
  for (const connection of connections) {
    if (!connection || connection.status === 'revoked') continue;
    const expires = connection.token_expires_at ? Date.parse(connection.token_expires_at) : 0;
    if (connection.status === 'active' && expires > Date.now() + 5 * 60 * 1000) continue;
    const result = await refreshConnectionToken(supabase, env, connection);
    if (result.ok) refreshed++;
    else failed++;
  }
  return json({ refreshed, failed });
});
