import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from '../_shared/auth.ts';
import { extractBodyHtml, extractBodyText } from '../_shared/gmailBody.ts';
import { isUserInOrganization } from '../_shared/organizationMembership.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

interface RequestBody {
  messageId?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
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
  const userId = user.id;

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const messageId = body.messageId?.trim();
  if (!messageId) {
    return new Response(JSON.stringify({ error: 'messageId is required' }), {
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
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Org comes from the stored MESSAGE row (never the caller): find the inbox_messages row whose
  // meta.gmail.messageId matches, and read its organization_id. This is the tenant boundary — the
  // service-role client bypasses RLS, so the org must be derived from data, not trusted from input.
  const { data: msgRow, error: msgRowError } = await supabase
    .from('inbox_messages')
    .select('organization_id')
    .eq('meta->gmail->>messageId', messageId)
    .limit(1)
    .maybeSingle();
  if (msgRowError) {
    console.error('gmail-fetch-message-html: message lookup failed', msgRowError);
  }
  // Same 404 shape for "no such message" and "caller not a member of its org" — do not leak existence.
  const orgId = msgRow?.organization_id ?? null;
  if (!orgId || !(await isUserInOrganization(supabase, userId, orgId))) {
    return new Response(JSON.stringify({ error: 'Message not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Resolve the ORG's active Gmail connection explicitly by organization_id (no user_id fallback).
  const { data: connection, error: connError } = await supabase
    .from('gmail_connections')
    .select('id, refresh_token, organization_id')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .maybeSingle();
  if (connError || !connection) {
    return new Response(JSON.stringify({ error: 'No Gmail connection found for this organization' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? Deno.env.get('GMAIL_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ?? Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET');
  if (!clientId?.trim() || !clientSecret?.trim()) {
    return new Response(JSON.stringify({ error: 'Gmail OAuth not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      refresh_token: connection.refresh_token,
    }),
  });
  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('gmail-fetch-message-html: token refresh failed', tokenRes.status, errText);
    // Permanent failure (revoked/expired grant): mark the org connection revoked so the UI prompts an
    // admin to reconnect. Transient errors do not touch status.
    if (tokenRes.status === 400 && errText.includes('invalid_grant')) {
      await supabase
        .from('gmail_connections')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('id', connection.id);
      return new Response(
        JSON.stringify({ error: 'Gmail connection is no longer authorized; reconnect required' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ error: 'Failed to authenticate with Gmail' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const tokenData = (await tokenRes.json()) as { access_token: string };

  const msgRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );
  if (!msgRes.ok) {
    const errText = await msgRes.text();
    return new Response(JSON.stringify({ error: `Failed to fetch Gmail message: ${errText}` }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const message = (await msgRes.json()) as {
    payload?: {
      body?: { data?: string };
      parts?: Array<{
        mimeType?: string;
        body?: { data?: string };
        parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
      }>;
    };
  };
  const payload = message.payload ?? {};
  let html = extractBodyHtml(payload);
  if (!html) {
    const text = extractBodyText(payload);
    html = text ? `<pre>${escapeHtml(text)}</pre>` : '';
  }

  return new Response(JSON.stringify({ ok: true, messageId, html }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
