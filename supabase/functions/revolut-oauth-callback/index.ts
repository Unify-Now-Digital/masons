import { refreshTokenExpiresAt } from '../_shared/revolut/hosts.ts';
import {
  adminClient,
  appRedirect,
  ensureWebhook,
  exchangeAuthCode,
  isFinanceMember,
  isRevolutEnv,
  readRevolutEnv,
} from '../_shared/revolutRuntime.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  const env = readRevolutEnv();
  if (!isRevolutEnv(env)) return new Response('Revolut is not configured', { status: 500 });
  const fail = (code: string) => appRedirect(env.appUrl, { revolut_error: code });

  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return fail('missing_code_or_state');

  const supabase = adminClient();
  if (!supabase) return fail('server_config');

  const now = new Date().toISOString();
  const { data: stateRow, error: stateErr } = await supabase
    .from('revolut_oauth_states')
    .update({ consumed_at: now })
    .eq('state', state)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('user_id, organization_id')
    .maybeSingle();
  if (stateErr) {
    console.error('revolut oauth state', stateErr.code);
    return fail('db_error');
  }
  if (!stateRow?.user_id || !stateRow.organization_id) return fail('invalid_state');
  if (!await isFinanceMember(supabase, stateRow.user_id, stateRow.organization_id)) return fail('not_finance');

  const { data: taken } = await supabase
    .from('revolut_connections')
    .select('id')
    .eq('client_id', env.clientId)
    .eq('status', 'active')
    .neq('organization_id', stateRow.organization_id)
    .maybeSingle();
  if (taken) return fail('client_in_use');

  let token: Awaited<ReturnType<typeof exchangeAuthCode>>;
  try {
    token = await exchangeAuthCode(env, code);
  } catch (err) {
    console.error('revolut jwt', err instanceof Error ? err.message : 'sign_failed');
    return fail('jwt_sign_failed');
  }
  if (!token.ok || !token.data.refresh_token) return fail(token.ok ? 'no_tokens' : 'token_exchange_failed');

  const { data: existing } = await supabase
    .from('revolut_connections')
    .select('id, webhook_id')
    .eq('organization_id', stateRow.organization_id)
    .maybeSingle();

  const webhook = await ensureWebhook(
    env.hosts.api,
    token.data.access_token!,
    env.webhookUrl,
    existing?.webhook_id ?? null,
  );

  const issued = Date.now();
  const payload = {
    user_id: stateRow.user_id,
    organization_id: stateRow.organization_id,
    client_id: env.clientId,
    access_token: token.data.access_token,
    refresh_token: token.data.refresh_token,
    token_expires_at: new Date(issued + (token.data.expires_in ?? 2399) * 1000).toISOString(),
    refresh_token_expires_at: refreshTokenExpiresAt(issued, token.data.refresh_token_expires_in),
    webhook_id: webhook.id,
    webhook_signing_secret: webhook.signingSecret,
    status: 'active',
    environment: env.hosts.environment,
    last_sync_error: webhook.signingSecret ? null : 'webhook_registration_failed',
    updated_at: now,
  };

  const write = existing?.id
    ? await supabase.from('revolut_connections').update(payload).eq('id', existing.id)
    : await supabase.from('revolut_connections').insert(payload);
  if (write.error) {
    console.error('revolut connection write', write.error.code);
    return fail('db_error');
  }

  return appRedirect(env.appUrl, webhook.signingSecret
    ? { revolut: 'connected' }
    : { revolut: 'connected', revolut_warning: 'webhook' });
});
