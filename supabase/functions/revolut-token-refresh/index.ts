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

/**
 * Sign a JWT for Revolut API authentication.
 * Uses the RS256 algorithm with the private key stored in REVOLUT_PRIVATE_KEY env.
 */
async function signJwt(clientId: string, issuer: string): Promise<string> {
  const privateKeyPem = Deno.env.get('REVOLUT_PRIVATE_KEY') ?? '';
  if (!privateKeyPem) throw new Error('REVOLUT_PRIVATE_KEY not set');

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

    // Check if token needs refresh (within 5 min of expiry)
    const expiresAt = new Date(connection.token_expires_at).getTime();
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;

    if (expiresAt > fiveMinFromNow) {
      return jsonResponse({ success: true, message: 'Token still valid' });
    }

    // Sign JWT for client assertion
    const jwt = await signJwt(connection.client_id, connection.client_id);

    // Refresh the token
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

      // Mark connection as expired if refresh fails
      await supabase
        .from('revolut_connections')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', connection.id);

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

    return jsonResponse({ success: true, expires_at: newExpiresAt });
  } catch (err) {
    console.error('revolut-token-refresh error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
