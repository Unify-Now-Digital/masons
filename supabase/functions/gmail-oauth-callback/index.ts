import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

function base64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (3 - (s.length % 4)) % 4);
  return atob(padded);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');

  const appUrl = (Deno.env.get('APP_URL') || '').replace(/\/$/, '');
  if (!appUrl) {
    // fallback: safe error (don’t redirect to Supabase host)
    return new Response('APP_URL is not configured', { status: 500 });
  }
  const baseRedirect = `${appUrl}/dashboard/inbox`;

  const redirectWith = (params: Record<string, string>) => {
    const u = new URL(baseRedirect);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return Response.redirect(u.toString(), 302);
  };

  if (!code || !stateParam) {
    return redirectWith({ error: 'missing_code_or_state' });
  }

  // The state payload carries ONLY an opaque nonce (see gmail-oauth-start). It is unsigned and
  // forgeable, so identity is NEVER read from it — user/org come from the oauth_state row below.
  let nonce: string;
  try {
    const parsed = JSON.parse(base64UrlDecode(stateParam)) as { nonce?: unknown };
    if (typeof parsed?.nonce !== 'string' || !parsed.nonce) {
      return redirectWith({ error: 'invalid_state' });
    }
    nonce = parsed.nonce;
  } catch {
    return redirectWith({ error: 'invalid_state' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectWith({ error: 'server_config' });
  }
  // Service role scope: oauth_state consume (deny-all RLS), the admin re-check read, and the
  // gmail_connections revoke/insert. Nothing else.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Atomic single-use consume: one UPDATE marks the nonce consumed and returns the identity it
  // binds. Forged (no row), replayed (consumed_at set), and expired (expires_at passed) states
  // all collapse to zero rows returned.
  const { data: stateRows, error: consumeError } = await supabaseAdmin
    .from('oauth_state')
    .update({ consumed_at: new Date().toISOString() })
    .eq('nonce', nonce)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('user_id, organization_id');
  if (consumeError) {
    console.error('gmail-oauth-callback: oauth_state consume failed', consumeError);
    return redirectWith({ error: 'db_error' });
  }
  const stateRow = stateRows?.[0];
  if (!stateRow?.user_id || !stateRow?.organization_id) {
    return redirectWith({ error: 'invalid_state' });
  }
  const userId = stateRow.user_id as string;
  const organizationId = stateRow.organization_id as string;

  // Admin re-check (FR-008, defence in depth): the role may have been revoked between start and
  // callback. Same query shape as gmail-oauth-start. The nonce stays consumed — it is single-use.
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('role', 'admin')
    .maybeSingle();
  if (membershipError) {
    console.error('gmail-oauth-callback: admin membership lookup failed', membershipError);
    return redirectWith({ error: 'db_error' });
  }
  if (!membership) {
    return redirectWith({ error: 'forbidden' });
  }

  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? Deno.env.get('GMAIL_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ?? Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET');
  const redirectUri = Deno.env.get('GMAIL_OAUTH_REDIRECT_URL');
  if (!clientId?.trim() || !clientSecret?.trim() || !redirectUri?.trim()) {
    return redirectWith({ error: 'server_config' });
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      redirect_uri: redirectUri.trim(),
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Google token exchange failed', tokenRes.status, errText);
    return redirectWith({ error: 'token_exchange_failed' });
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const refreshToken = tokenData.refresh_token;
  const accessToken = tokenData.access_token;
  if (!refreshToken || !accessToken) {
    return redirectWith({ error: 'no_tokens' });
  }

  const expiresIn = tokenData.expires_in ?? 3600;
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  let emailAddress: string | null = null;
  if (profileRes.ok) {
    const profile = (await profileRes.json()) as { email?: string };
    emailAddress = profile.email ?? null;
  }

  // Org-scoped revoke BEFORE insert (FR-009): idx_gmail_connections_one_active_per_org allows a
  // single active row per org, so inserting first would violate the index — regardless of which
  // admin connected the previous mailbox.
  const { error: revokeError } = await supabaseAdmin
    .from('gmail_connections')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .eq('status', 'active');
  if (revokeError) {
    console.error('gmail-oauth-callback: org-scoped revoke failed', revokeError);
    return redirectWith({ error: 'db_error' });
  }

  const now = new Date().toISOString();
  // Leave last_synced_at null until gmail-sync-now completes a successful run.
  // Setting it to "now" on connect caused messages.list to use after:<connect_time>,
  // permanently skipping the first inbound in threads that started before OAuth finished.
  const { error: insertError } = await supabaseAdmin.from('gmail_connections').insert({
    user_id: userId,
    organization_id: organizationId,
    provider: 'google',
    email_address: emailAddress,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: tokenExpiresAt,
    scope: 'gmail.readonly gmail.send gmail.modify',
    status: 'active',
    created_at: now,
    updated_at: now,
  });
  if (insertError) {
    // The prior active row was already revoked above, so the org temporarily has no active
    // connection until an admin reconnects. Surface loudly rather than half-succeed silently.
    console.error(
      'gmail-oauth-callback: connection insert failed after revoke — org has no active connection until reconnect',
      insertError,
    );
    return redirectWith({ error: 'db_error' });
  }

  return redirectWith({ gmail: 'connected' });
});
