/**
 * One-time / on-demand backfill: refresh stale inbox_messages.body_text for Gmail
 * by re-fetching from Gmail API and re-running the same extraction as gmail-sync-now.
 * Does not change normal sync duplicate behavior. Idempotent.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { extractBodyText } from './gmailBody.ts';
import { getUserFromRequest } from './auth.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

interface RefreshBody {
  conversation_id?: string;
  message_id?: string; // Gmail message ID (meta.gmail.messageId) to refresh a single message
  created_before?: string; // ISO date
  limit?: number;
}

interface GmailMessageResponse {
  id: string;
  threadId?: string;
  snippet: string;
  payload: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
    }>;
  };
}

type InboxMessageRow = {
  id: string;
  conversation_id: string;
  sent_at: string;
  meta: { gmail?: { messageId?: string; threadId?: string } } | null;
};

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const body = (await req.json().catch(() => ({}))) as RefreshBody;
  const conversationIdFilter = body.conversation_id ?? undefined;
  const gmailMessageIdFilter = body.message_id ?? undefined;
  const createdBefore = body.created_before ?? undefined;
  const limit = Math.min(Math.max(1, body.limit ?? 500), 500);

  // Gmail connection and token (same as gmail-sync-now)
  const { data: connection, error: connError } = await supabase
    .from('gmail_connections')
    .select('id, refresh_token')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (connError || !connection) {
    return new Response(
      JSON.stringify({ error: 'No Gmail connection', rows_scanned: 0, rows_refreshed: 0, preview_updated: 0, rows_skipped: 0, errors: 1 }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? Deno.env.get('GMAIL_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ?? Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET');
  if (!clientId?.trim() || !clientSecret?.trim()) {
    return new Response(
      JSON.stringify({ error: 'Gmail OAuth not configured', rows_scanned: 0, rows_refreshed: 0, preview_updated: 0, rows_skipped: 0, errors: 1 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
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
    console.error('gmail-refresh-body: token refresh failed', tokenRes.status, errText);
    return new Response(
      JSON.stringify({ error: 'Failed to authenticate with Gmail', rows_scanned: 0, rows_refreshed: 0, preview_updated: 0, rows_skipped: 0, errors: 1 }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  const tokenData = (await tokenRes.json()) as { access_token: string };
  const accessToken = tokenData.access_token;

  // Eligible rows: channel = email, has Gmail message ID, optional filters
  let query = supabase
    .from('inbox_messages')
    .select('id, conversation_id, sent_at, meta')
    .eq('user_id', userId)
    .eq('channel', 'email')
    .not('meta->gmail->messageId', 'is', null)
    .order('conversation_id')
    .order('sent_at')
    .limit(limit);

  if (conversationIdFilter) query = query.eq('conversation_id', conversationIdFilter);
  if (createdBefore) query = query.lt('created_at', createdBefore);
  if (gmailMessageIdFilter) query = query.eq('meta->gmail->messageId', gmailMessageIdFilter);

  const { data: rows, error: rowsError } = await query;
  if (rowsError) {
    console.error('gmail-refresh-body: eligible query failed', rowsError);
    return new Response(
      JSON.stringify({ error: 'Failed to load messages', rows_scanned: 0, rows_refreshed: 0, preview_updated: 0, rows_skipped: 0, errors: 1 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  const eligible = (rows ?? []) as InboxMessageRow[];
  const rowsScanned = eligible.length;

  if (eligible.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        rows_scanned: rowsScanned,
        rows_refreshed: 0,
        preview_updated: 0,
        rows_skipped: 0,
        errors: 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Max sent_at per conversation (for preview update): from all messages in those conversations
  const convIds = [...new Set(eligible.map((r) => r.conversation_id))];
  const { data: allInConv } = await supabase
    .from('inbox_messages')
    .select('conversation_id, sent_at')
    .in('conversation_id', convIds);
  const maxSentAtByConv: Record<string, string> = {};
  for (const row of allInConv ?? []) {
    const cid = (row as { conversation_id: string }).conversation_id;
    const sent = (row as { sent_at: string }).sent_at;
    if (!maxSentAtByConv[cid] || sent > maxSentAtByConv[cid]) maxSentAtByConv[cid] = sent;
  }

  let rowsRefreshed = 0;
  let previewUpdated = 0;
  let rowsSkipped = 0;
  let errors = 0;

  for (const row of eligible) {
    const gmailMessageId = row.meta?.gmail?.messageId;
    if (!gmailMessageId) {
      rowsSkipped++;
      continue;
    }
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!msgRes.ok) {
        if (msgRes.status === 404 || msgRes.status === 410) {
          console.warn('gmail-refresh-body: message not found in Gmail', { gmailMessageId, inboxId: row.id });
          rowsSkipped++;
        } else {
          console.error('gmail-refresh-body: fetch failed', msgRes.status, await msgRes.text());
          errors++;
        }
        continue;
      }
      const message = (await msgRes.json()) as GmailMessageResponse;
      let newBody = extractBodyText(message.payload);
      if (!newBody) newBody = message.snippet ?? '';
      if (!newBody) {
        rowsSkipped++;
        continue;
      }

      const { error: updateErr } = await supabase
        .from('inbox_messages')
        .update({ body_text: newBody })
        .eq('id', row.id);
      if (updateErr) {
        console.error('gmail-refresh-body: update body_text failed', { inboxId: row.id, err: updateErr });
        errors++;
        continue;
      }
      rowsRefreshed++;

      const isLatestInConv = maxSentAtByConv[row.conversation_id] === row.sent_at;
      if (isLatestInConv) {
        const preview = newBody.slice(0, 120);
        const { error: convErr } = await supabase
          .from('inbox_conversations')
          .update({ last_message_preview: preview })
          .eq('id', row.conversation_id);
        if (convErr) {
          console.error('gmail-refresh-body: update last_message_preview failed', { conversationId: row.conversation_id, err: convErr });
        } else {
          previewUpdated++;
        }
      }
    } catch (e) {
      console.error('gmail-refresh-body: process message', { inboxId: row.id, gmailMessageId, e });
      errors++;
    }
  }

  const summary = {
    ok: true,
    rows_scanned: rowsScanned,
    rows_refreshed: rowsRefreshed,
    preview_updated: previewUpdated,
    rows_skipped: rowsSkipped,
    errors,
  };
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
