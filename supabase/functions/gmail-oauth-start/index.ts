import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
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

/** How long an oauth_state nonce stays valid; the callback rejects anything older. */
const STATE_TTL_MS = 10 * 60 * 1000;

function base64UrlEncode(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface StartBody {
  /** Required: the org whose mailbox is being connected. The caller must be an admin of it. */
  organizationId?: string;
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

  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Org-scoped: the target org comes from the request, NOT inferred from the caller's memberships.
  // A caller who belongs to more than one org would otherwise connect the mailbox to the wrong org.
  const body = (await req.json().catch(() => ({}))) as StartBody;
  const orgId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
  if (!orgId) {
    return new Response(JSON.stringify({ error: 'organizationId is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  // Service-role client: needed because oauth_state is deny-all RLS (only edge functions touch it).
  // Also runs the admin-gate read below, same as whatsapp-connect. Nothing else uses it.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Admin gate (FR-008): connecting the org mailbox is admin-only, checked server-side.
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('role', 'admin')
    .maybeSingle();
  if (membershipError || !membership) {
    if (membershipError) {
      console.error('gmail-oauth-start: admin membership lookup failed', membershipError);
    }
    return new Response(JSON.stringify({ error: 'Admin access required to connect Gmail' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

  // Opportunistic prune: expired nonces are harmless (the callback rejects them) but shouldn't
  // accumulate. Non-fatal — a prune failure must not block the connect flow.
  const { error: pruneError } = await supabaseAdmin
    .from('oauth_state')
    .delete()
    .lt('expires_at', new Date().toISOString());
  if (pruneError) {
    console.error('gmail-oauth-start: oauth_state prune failed', pruneError);
  }

  // Persist the single-use nonce binding this admin + org server-side. The redirect state carries
  // ONLY the opaque nonce — no identity — so a forged state can never name a victim org; the
  // callback resolves user/org from this row (contracts/gmail-oauth-connect.md).
  const nonce = randomNonce();
  const { error: stateInsertError } = await supabaseAdmin.from('oauth_state').insert({
    nonce,
    user_id: user.id,
    organization_id: orgId,
    expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  });
  if (stateInsertError) {
    // Without a persisted row the callback can only reject this state — don't hand out the URL.
    console.error('gmail-oauth-start: oauth_state insert failed', stateInsertError);
    return new Response(JSON.stringify({ error: 'Failed to initialize Gmail connect flow' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const state = base64UrlEncode(JSON.stringify({ nonce }));
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
