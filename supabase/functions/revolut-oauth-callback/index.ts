import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

function base64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (3 - (s.length % 4)) % 4);
  return atob(padded);
}

/**
 * Sign a JWT for Revolut API authentication.
 * Uses RS256 with the private key from REVOLUT_PRIVATE_KEY secret.
 */
async function signJwt(clientId: string, issuer: string): Promise<string> {
  const privateKeyPem = Deno.env.get('REVOLUT_PRIVATE_KEY') ?? '';
  if (!privateKeyPem) {
    throw new Error(
      'REVOLUT_PRIVATE_KEY not set. Store it in Supabase secrets: ' +
      'supabase secrets set REVOLUT_PRIVATE_KEY="$(cat private.pem)"'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: issuer,
    sub: clientId,
    aud: 'https://revolut.com',
    iat: now,
    exp: now + 60 * 2, // 2 min expiry
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import RSA private key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signingInput}.${sigB64}`;
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
    return new Response('APP_URL is not configured', { status: 500 });
  }
  const baseRedirect = `${appUrl}/dashboard/settings`;

  const redirectWith = (params: Record<string, string>) => {
    const redirectUrl = new URL(baseRedirect);
    Object.entries(params).forEach(([k, v]) => redirectUrl.searchParams.set(k, v));
    return Response.redirect(redirectUrl.toString(), 302);
  };

  if (!code || !stateParam) {
    return redirectWith({ revolut_error: 'missing_code_or_state' });
  }

  let state: { userId?: string; nonce?: string };
  try {
    state = JSON.parse(base64UrlDecode(stateParam)) as { userId?: string; nonce?: string };
  } catch {
    return redirectWith({ revolut_error: 'invalid_state' });
  }

  const userId = state?.userId;
  if (!userId) {
    return redirectWith({ revolut_error: 'invalid_state' });
  }

  const clientId = Deno.env.get('REVOLUT_CLIENT_ID') ?? '';
  const redirectUri = Deno.env.get('REVOLUT_OAUTH_REDIRECT_URL') ?? '';
  const webhookUrl = Deno.env.get('REVOLUT_WEBHOOK_URL') ?? '';
  if (!clientId.trim() || !redirectUri.trim() || !webhookUrl.trim()) {
    return redirectWith({ revolut_error: 'server_config' });
  }

  let jwt: string;
  try {
    jwt = await signJwt(clientId.trim(), clientId.trim());
  } catch (err) {
    console.error('Failed to sign Revolut JWT:', err);
    return redirectWith({ revolut_error: 'jwt_sign_failed' });
  }

  const tokenRes = await fetch('https://b2b.revolut.com/api/1.0/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId.trim(),
      redirect_uri: redirectUri.trim(),
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Revolut token exchange failed', tokenRes.status, errText);
    return redirectWith({ revolut_error: 'token_exchange_failed' });
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
  };

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  if (!accessToken || !refreshToken) {
    return redirectWith({ revolut_error: 'no_tokens' });
  }

  const expiresIn = tokenData.expires_in ?? 3600;
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const refreshTokenExpiresAt = tokenData.refresh_token_expires_in
    ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000).toISOString()
    : null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return redirectWith({ revolut_error: 'server_config' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) {
    console.error('revolut-oauth-callback: organization_members lookup', membershipError);
    return redirectWith({ revolut_error: 'db_error' });
  }
  if (!membership?.organization_id) {
    return redirectWith({ revolut_error: 'no_org' });
  }
  const organizationId = membership.organization_id as string;

  const { data: existingConnection, error: existingErr } = await supabaseAdmin
    .from('revolut_connections')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existingErr) {
    console.error('revolut-oauth-callback: existing connection lookup', existingErr);
    return redirectWith({ revolut_error: 'db_error' });
  }

  const webhookRes = await fetch('https://b2b.revolut.com/api/1.0/webhooks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl.trim(),
      events: ['TransactionCreated', 'TransactionStateChanged'],
    }),
  });

  if (!webhookRes.ok) {
    const errText = await webhookRes.text();
    console.error('Revolut webhook registration failed', webhookRes.status, errText);
    return redirectWith({ revolut_error: 'webhook_registration_failed' });
  }

  const webhookData = (await webhookRes.json()) as {
    id?: string;
    signing_secret?: string;
    secret?: string;
  };

  const now = new Date().toISOString();
  const connectionPayload = {
    user_id: userId,
    organization_id: organizationId,
    client_id: clientId.trim(),
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: tokenExpiresAt,
    refresh_token_expires_at: refreshTokenExpiresAt,
    webhook_id: webhookData.id ?? null,
    webhook_signing_secret: webhookData.signing_secret ?? webhookData.secret ?? null,
    status: 'active',
    updated_at: now,
  };

  const writeResult = existingConnection?.id
    ? await supabaseAdmin
        .from('revolut_connections')
        .update(connectionPayload)
        .eq('id', existingConnection.id)
    : await supabaseAdmin
        .from('revolut_connections')
        .insert({ ...connectionPayload, created_at: now });

  if (writeResult.error) {
    console.error('revolut-oauth-callback: upsert connection failed', writeResult.error);
    return redirectWith({ revolut_error: 'db_error' });
  }

  return redirectWith({ revolut: 'connected' });
});
