import {
  adminClient,
  consentUrl,
  corsHeaders,
  isFinanceMember,
  isRevolutEnv,
  json,
  newOauthState,
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

  let organizationId = '';
  try {
    const body = await req.json() as { organization_id?: string };
    organizationId = (body.organization_id ?? '').trim();
  } catch {
    return json({ error: 'organisation_id is required' }, 400);
  }
  if (!organizationId) return json({ error: 'organisation_id is required' }, 400);

  const supabase = adminClient();
  if (!supabase) return json({ error: 'Revolut is not configured' }, 500);
  if (!await isFinanceMember(supabase, user.id, organizationId)) {
    return json({ error: 'Only people who can see finance can connect Revolut' }, 403);
  }

  const { data: other } = await supabase
    .from('revolut_connections')
    .select('id, organization_id')
    .eq('client_id', env.clientId)
    .eq('status', 'active')
    .neq('organization_id', organizationId)
    .maybeSingle();
  if (other) {
    return json({ error: 'This Revolut account is already connected to another organisation' }, 409);
  }

  const state = newOauthState();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabase.from('revolut_oauth_states').insert({
    state,
    user_id: user.id,
    organization_id: organizationId,
    expires_at: expires,
  });
  if (error) {
    console.error('revolut oauth state', error.code);
    return json({ error: 'Could not start the Revolut connection' }, 500);
  }

  return json({ url: consentUrl(env, state) });
});
