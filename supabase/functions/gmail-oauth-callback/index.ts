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

  let state: { userId?: string; nonce?: string };
  try {
    state = JSON.parse(base64UrlDecode(stateParam)) as { userId?: string; nonce?: string };
  } catch {
    return redirectWith({ error: 'invalid_state' });
  }
  const userId = state?.userId;
  if (!userId) {
    return redirectWith({ error: 'invalid_state' });
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectWith({ error: 'server_config' });
  }
  // Service role only: bypasses RLS (gmail_connections has org-scoped policies for authenticated).
  // Safe here: userId comes from OAuth state; revoke + insert are explicitly scoped to that userId.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // organization_members has no status column — role is admin|member; pick earliest membership if several.
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) {
    console.error('gmail-oauth-callback: organization_members lookup', membershipError);
    return redirectWith({ error: 'db_error' });
  }
  if (!membership?.organization_id) {
    return redirectWith({ error: 'no_org' });
  }
  const organizationId = membership.organization_id as string;

  const { error: revokeError } = await supabaseAdmin
    .from('gmail_connections')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (revokeError) {
    console.error('Revoke existing gmail_connections', revokeError);
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
    console.error('Insert gmail_connection', insertError);
    return redirectWith({ error: 'db_error' });
  }

  return redirectWith({ gmail: 'connected' });
});
