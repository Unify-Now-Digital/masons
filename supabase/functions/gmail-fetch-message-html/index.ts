import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from '../_shared/auth.ts';
import { extractBodyHtml, extractBodyText } from '../_shared/gmailBody.ts';

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

  const { data: connection, error: connError } = await supabase
    .from('gmail_connections')
    .select('refresh_token')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (connError || !connection) {
    return new Response(JSON.stringify({ error: 'No Gmail connection' }), {
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
    return new Response(JSON.stringify({ error: `Failed to authenticate with Gmail: ${errText}` }), {
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
