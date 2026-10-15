import {
  accessTokenFor,
  adminClient,
  corsHeaders,
  deleteWebhook,
  isFinanceMember,
  isRevolutEnv,
  json,
  loadActiveConnection,
  readRevolutEnv,
  requester,
} from '../_shared/revolutRuntime.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const user = await requester(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const env = readRevolutEnv();
  if (!isRevolutEnv(env)) return json({ error: 'Revolut is not configured' }, 500);
  const supabase = adminClient();
  if (!supabase) return json({ error: 'Revolut is not configured' }, 500);

  let organizationId = '';
  try {
    const body = await req.json() as { organization_id?: string };
    organizationId = (body.organization_id ?? '').trim();
  } catch {
    return json({ error: 'organisation_id is required' }, 400);
  }
  if (!organizationId) return json({ error: 'organisation_id is required' }, 400);
  if (!await isFinanceMember(supabase, user.id, organizationId)) return json({ error: 'Forbidden' }, 403);

  const connection = await loadActiveConnection(supabase, organizationId);
  if (!connection) return json({ error: 'No Revolut connection' }, 404);

  if (connection.status === 'active') {
    const access = await accessTokenFor(supabase, env, connection);
    if (access.ok) await deleteWebhook(access.api, access.accessToken, connection.webhook_id);
  }

  const { error } = await supabase.from('revolut_connections').update({
    status: 'revoked',
    access_token: null,
    refresh_token: null,
    webhook_signing_secret: null,
    webhook_id: null,
    updated_at: new Date().toISOString(),
  }).eq('id', connection.id).eq('organization_id', organizationId);
  if (error) return json({ error: 'Could not disconnect' }, 500);
  return json({ disconnected: true });
});
