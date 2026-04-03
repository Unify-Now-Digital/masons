import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-admin-token',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// SECURITY NOTE: The RSA private key (REVOLUT_PRIVATE_KEY) MUST be stored in
// Supabase Edge Function secrets only. Never commit to git, .env files, or
// client-accessible storage. Set via:
//   supabase secrets set REVOLUT_PRIVATE_KEY="$(cat private.pem)"
//
// SCOPE NOTE: When registering the Revolut API application, request READ scope
// only. This integration only needs to read transactions. WRITE scope would
// allow initiating payments — an unnecessary risk if the token is compromised.
// ---------------------------------------------------------------------------

const REFRESH_TOKEN_WARNING_DAYS = 14;

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

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Check refresh token expiry and create an alert if within warning threshold.
 * Alerts are written to activity_logs for visibility in the app.
 */
async function checkRefreshTokenExpiry(
  supabase: SupabaseClient,
  connection: { id: string; user_id: string; refresh_token_expires_at: string | null }
): Promise<{ warning: boolean; days_remaining: number | null }> {
  if (!connection.refresh_token_expires_at) {
    return { warning: false, days_remaining: null };
  }

  const expiresAt = new Date(connection.refresh_token_expires_at).getTime();
  const daysRemaining = Math.floor((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysRemaining <= REFRESH_TOKEN_WARNING_DAYS) {
    // Write alert to activity_logs (visible in app's activity page)
    try {
      await supabase.from('activity_logs').insert({
        user_id: connection.user_id,
        action: 'revolut_token_expiry_warning',
        entity_type: 'revolut_connection',
        entity_id: connection.id,
        details: {
          days_remaining: daysRemaining,
          expires_at: connection.refresh_token_expires_at,
          message: daysRemaining <= 0
            ? 'CRITICAL: Revolut refresh token has EXPIRED. Re-authenticate immediately to resume payment sync.'
            : `Revolut refresh token expires in ${daysRemaining} day(s). Re-authenticate before it expires to avoid payment sync interruption.`,
          severity: daysRemaining <= 3 ? 'critical' : 'warning',
        },
      });
    } catch (err) {
      // activity_logs may not exist yet — log to console as fallback
      console.error(`REVOLUT TOKEN EXPIRY WARNING: ${daysRemaining} days remaining`, err);
    }

    return { warning: true, days_remaining: daysRemaining };
  }

  return { warning: false, days_remaining: daysRemaining };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch active Revolut connection
    const { data: connection, error: connErr } = await supabase
      .from('revolut_connections')
      .select('*')
      .eq('status', 'active')
      .single();

    if (connErr || !connection) {
      return jsonResponse({ error: 'No active Revolut connection found' }, 404);
    }

    // --- Check refresh token expiry (14-day warning) ---
    const expiryCheck = await checkRefreshTokenExpiry(supabase, connection);
    if (expiryCheck.days_remaining !== null && expiryCheck.days_remaining <= 0) {
      // Refresh token expired — mark connection and return error
      await supabase
        .from('revolut_connections')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', connection.id);

      return jsonResponse({
        error: 'Revolut refresh token has expired. Re-authenticate via Revolut Business settings.',
        refresh_token_expired: true,
        days_remaining: expiryCheck.days_remaining,
      }, 401);
    }

    // --- Check if access token needs refresh (within 5 min of expiry) ---
    const expiresAt = new Date(connection.token_expires_at).getTime();
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;

    if (expiresAt > fiveMinFromNow) {
      return jsonResponse({
        success: true,
        message: 'Token still valid',
        ...(expiryCheck.warning ? {
          refresh_token_warning: true,
          refresh_token_days_remaining: expiryCheck.days_remaining,
        } : {}),
      });
    }

    // --- Sign JWT for client assertion ---
    const jwt = await signJwt(connection.client_id, connection.client_id);

    // --- Refresh the access token ---
    const tokenRes = await fetch('https://b2b.revolut.com/api/1.0/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token,
        client_id: connection.client_id,
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: jwt,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Revolut token refresh failed:', errText);

      // Mark connection as expired
      await supabase
        .from('revolut_connections')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', connection.id);

      // Write critical alert
      try {
        await supabase.from('activity_logs').insert({
          user_id: connection.user_id,
          action: 'revolut_token_refresh_failed',
          entity_type: 'revolut_connection',
          entity_id: connection.id,
          details: {
            error: errText.substring(0, 500),
            message: 'Revolut token refresh FAILED. Payment sync is stopped. Re-authenticate immediately.',
            severity: 'critical',
          },
        });
      } catch {
        // fallback
      }

      return jsonResponse({ error: 'Token refresh failed', details: errText }, 500);
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Update connection with new token
    const { error: updateErr } = await supabase
      .from('revolut_connections')
      .update({
        access_token: tokenData.access_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    if (updateErr) {
      console.error('Failed to save refreshed token:', updateErr);
      return jsonResponse({ error: 'Failed to save token' }, 500);
    }

    return jsonResponse({
      success: true,
      expires_at: newExpiresAt,
      ...(expiryCheck.warning ? {
        refresh_token_warning: true,
        refresh_token_days_remaining: expiryCheck.days_remaining,
      } : {}),
    });
  } catch (err) {
    console.error('revolut-token-refresh error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
