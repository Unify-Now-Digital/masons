import { getUserFromRequest } from './auth.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const GMAIL_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

function base64UrlEncode(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log("auth headers debug", {
    xSupabaseAuthUser: req.headers.get("x-supabase-auth-user"),
    xSupabaseUser: req.headers.get("x-supabase-user"),
    xJwtClaimSub: req.headers.get("x-jwt-claim-sub"),
    hasAuthorization: !!req.headers.get("Authorization"),
  });

  const user = await getUserFromRequest(req);
  if (!user) {
  const headerNames = Array.from(req.headers.keys()).sort();

  return new Response(
    JSON.stringify({
      error: 'Unauthorized',
      debug: {
        method: req.method,
        headerNames,
        hasAuthorization: req.headers.has('authorization') || req.headers.has('Authorization'),
        supabaseUserHeaders: {
          xSupabaseAuthUser: req.headers.get('x-supabase-auth-user'),
          xSupabaseUser: req.headers.get('x-supabase-user'),
          xJwtClaimSub: req.headers.get('x-jwt-claim-sub'),
        },
      },
    }),
    {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

  const redirectUri = Deno.env.get('GMAIL_OAUTH_REDIRECT_URL');
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? Deno.env.get('GMAIL_OAUTH_CLIENT_ID');
  if (!redirectUri?.trim() || !clientId?.trim()) {
    return new Response(
      JSON.stringify({ error: 'Gmail OAuth is not configured (missing redirect URL or client ID)' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  const state = base64UrlEncode(
    JSON.stringify({ userId: user.id, nonce: randomNonce() }),
  );
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri.trim(),
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return new Response(JSON.stringify({ url }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
