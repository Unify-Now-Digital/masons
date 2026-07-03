import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface DisconnectBody {
  /** Required: the org whose mailbox is being disconnected. The caller must be an admin of it. */
  organizationId?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Org-scoped: the target org comes from the request, NOT inferred from the caller's memberships.
  // A caller who belongs to more than one org would otherwise disconnect the wrong org's mailbox.
  const body = (await req.json().catch(() => ({}))) as DisconnectBody;
  const orgId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
  if (!orgId) {
    return json({ error: 'organizationId is required' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server configuration error' }, 500);
  }
  // Service role scope: the admin-gate read, reading the active row's refresh token for the
  // best-effort Google-side revoke, and the org-scoped status flip. Nothing else.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Admin gate (FR-010): disconnecting the org mailbox is admin-only, checked server-side.
  // Same query shape as gmail-oauth-start / gmail-oauth-callback.
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('role', 'admin')
    .maybeSingle();
  if (membershipError || !membership) {
    if (membershipError) {
      console.error('gmail-disconnect: admin membership lookup failed', membershipError);
    }
    return json({ error: 'Admin access required to disconnect Gmail' }, 403);
  }

  // idx_gmail_connections_one_active_per_org guarantees at most one active row per org.
  const { data: connection, error: connectionError } = await supabaseAdmin
    .from('gmail_connections')
    .select('id, refresh_token')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .maybeSingle();
  if (connectionError) {
    console.error('gmail-disconnect: active connection lookup failed', connectionError);
    return json({ error: 'Failed to disconnect Gmail' }, 500);
  }
  if (!connection) {
    // Idempotent: the desired end-state (no active connection) already holds.
    return json({ success: true, noActiveConnection: true }, 200);
  }

  // Best-effort Google-side revocation: without it the refresh token stays live at Google even
  // though the app will never use it again. Failure must not block the disconnect — the DB flip
  // below is the source of truth for the app.
  if (connection.refresh_token) {
    try {
      const revokeRes = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: connection.refresh_token }),
      });
      if (!revokeRes.ok) {
        console.error('gmail-disconnect: Google token revocation failed', revokeRes.status, await revokeRes.text());
      }
    } catch (err) {
      console.error('gmail-disconnect: Google token revocation request errored', err);
    }
  }

  // Org-scoped status flip (FR-010). Service-role bypasses RLS, so the organization_id filter is
  // the tenant boundary here. The status filter makes a concurrent revoke (e.g. a reconnect's
  // revoke-before-insert) a harmless no-op rather than a double write.
  const { error: updateError } = await supabaseAdmin
    .from('gmail_connections')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', connection.id)
    .eq('organization_id', orgId)
    .eq('status', 'active');
  if (updateError) {
    console.error('gmail-disconnect: status update failed', updateError);
    return json({ error: 'Failed to disconnect Gmail' }, 500);
  }

  return json({ success: true }, 200);
});
