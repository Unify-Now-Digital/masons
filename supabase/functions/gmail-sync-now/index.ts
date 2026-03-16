import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { extractBodyText } from './gmailBody.ts';
import { getUserFromRequest } from './auth.ts';
import { attemptAutoLink } from './autoLinkConversation.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

interface SyncBody {
  since?: string;
}

interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId?: string }>;
}
interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
    }>;
  };
}

/** For investigation: which branch extractBodyText would use (no decoding). */
function getExtractBodyTextBranch(payload: GmailMessageResponse['payload']): string {
  if (payload.body?.data) return 'top-level-body';
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) return 'text/plain-part';
      if (part.parts) {
        for (const p of part.parts) {
          if (p.mimeType === 'text/plain' && p.body?.data) return 'nested-text/plain';
        }
      }
    }
  }
  return 'none';
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
    .select('id, refresh_token, email_address, last_synced_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (connError || !connection) {
    return new Response(JSON.stringify({ error: 'No Gmail connection' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const gmailConnectionId = connection.id;
  const userEmail = connection.email_address ?? '';

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
    console.error('Gmail token refresh failed', tokenRes.status, errText);
    return new Response(JSON.stringify({ error: 'Failed to authenticate with Gmail' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const tokenData = (await tokenRes.json()) as { access_token: string };
  const accessToken = tokenData.access_token;

  const body = (await req.json().catch(() => ({}))) as SyncBody;
  const since = body.since ?? connection.last_synced_at ?? new Date().toISOString();
  const sinceSec = Math.floor(new Date(since).getTime() / 1000);
  const queryParams = new URLSearchParams({
    labelIds: 'INBOX',
    maxResults: '100',
    q: `after:${sinceSec}`,
  });

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${queryParams.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!listRes.ok) {
    const errText = await listRes.text();
    console.error('Gmail messages.list error', listRes.status, errText);
    return new Response(JSON.stringify({ error: 'Failed to fetch Gmail messages' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const list = (await listRes.json()) as GmailMessageListResponse;
  const messageIds = list.messages ?? [];
  let synced = 0;

  for (const { id: messageId } of messageIds) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!msgRes.ok) continue;
      const message = (await msgRes.json()) as GmailMessageResponse;
      const headers = message.payload.headers;
      const getHeader = (n: string) => headers.find((h) => h.name === n)?.value ?? '';
      const fromHeader = getHeader('From');
      const toHeader = getHeader('To');
      const subjectHeader = getHeader('Subject');
      const dateHeader = getHeader('Date');
      const extractEmail = (h: string) => (h.match(/<(.+?)>/) ?? [null, h.trim()])[1] ?? h.trim();
      const fromEmail = extractEmail(fromHeader);
      const toEmail = extractEmail(toHeader);
      const subject = subjectHeader || '(no subject)';
      const direction = fromEmail === userEmail ? 'outbound' : 'inbound';
      const primaryHandle = direction === 'inbound' ? fromEmail : toEmail;
      let sentAt: string;
      try {
        const d = new Date(dateHeader);
        sentAt = !isNaN(d.getTime()) ? d.toISOString() : new Date(parseInt(message.internalDate)).toISOString();
      } catch {
        sentAt = new Date().toISOString();
      }
      let bodyText = extractBodyText(message.payload);
      if (!bodyText) bodyText = message.snippet ?? '';

      // Optional: diagnostic for one Gmail message (set GMAIL_DEBUG_MESSAGE_ID to message id).
      const debugMessageId = Deno.env.get('GMAIL_DEBUG_MESSAGE_ID');
      if (debugMessageId && message.id === debugMessageId) {
        const payload = message.payload;
        const getHeader = (name: string) =>
          payload.headers?.find((h: { name: string; value: string }) => h.name === name)?.value ?? '';
        const partHeader = (part: { headers?: Array<{ name: string; value: string }> }, name: string) =>
          part.headers?.find((h: { name: string; value: string }) => h.name === name)?.value ?? '';
        const payloadWithMime = payload as { mimeType?: string; headers?: Array<{ name: string; value: string }> };
        const payloadSummary = {
          mimeType: payloadWithMime.mimeType,
          hasPayloadBodyData: !!payload.body?.data,
          contentTransferEncoding: getHeader('Content-Transfer-Encoding'),
          contentType: getHeader('Content-Type'),
          parts: payload.parts?.map((p: { mimeType?: string; body?: { data?: string }; parts?: unknown[]; headers?: Array<{ name: string; value: string }> }) => ({
            mimeType: p.mimeType,
            hasBodyData: !!p.body?.data,
            contentType: partHeader(p, 'Content-Type'),
            contentTransferEncoding: partHeader(p, 'Content-Transfer-Encoding'),
            nestedCount: p.parts?.length ?? 0,
            nested: p.parts?.map((n: unknown) => {
              const np = n as { mimeType?: string; body?: { data?: string }; headers?: Array<{ name: string; value: string }> };
              return {
                mimeType: np.mimeType,
                hasBodyData: !!np.body?.data,
                contentType: partHeader(np, 'Content-Type'),
                contentTransferEncoding: partHeader(np, 'Content-Transfer-Encoding'),
              };
            }),
          })),
        };
        const branch = getExtractBodyTextBranch(payload);
        const { data: recentForDebug } = await supabase
          .from('inbox_messages')
          .select('id, body_text, created_at, meta')
          .eq('user_id', userId)
          .eq('channel', 'email')
          .limit(500);
        const existingRow = (recentForDebug ?? []).find(
          (r: { meta?: unknown }) => (r.meta as { gmail?: { messageId?: string } } | null)?.gmail?.messageId === message.id
        );
        const stored = existingRow
          ? {
              id: (existingRow as { id: string }).id,
              body_text: (existingRow as { body_text?: string }).body_text,
              created_at: (existingRow as { created_at?: string }).created_at,
            }
          : null;
        const report = {
          investigation: 'gmail-georgian-message-mime',
          messageId: message.id,
          threadId: message.threadId,
          payloadSummary,
          extractBodyTextBranch: branch,
          bodyTextLength: bodyText.length,
          bodyTextFromSnippet: bodyText === (message.snippet ?? ''),
          snippetLength: (message.snippet ?? '').length,
          stored: stored
            ? {
                rowId: stored.id,
                storedBodyTextLength: (stored.body_text ?? '').length,
                created_at: stored.created_at,
                storedMatchesCurrentBody: stored.body_text === bodyText,
                storedMatchesSnippet: stored.body_text === (message.snippet ?? ''),
                note: 'If storedMatchesCurrentBody is false and row exists, row may be from before current sync run (duplicate skip) or from different extraction.',
              }
            : null,
        };
        console.log(JSON.stringify(report, null, 2));
      }

      const { data: existingMsgs } = await supabase
        .from('inbox_messages')
        .select('conversation_id, meta')
        .eq('user_id', userId)
        .eq('channel', 'email')
        .limit(1000);
      const byThread = (existingMsgs ?? []).find((m: { meta?: { gmail?: { threadId?: string } }; conversation_id: string }) => (m.meta as { gmail?: { threadId?: string } } | null)?.gmail?.threadId === message.threadId);
      let conversationId: string;
      if (byThread) {
        conversationId = (byThread as { conversation_id: string }).conversation_id;
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from('inbox_conversations')
          .insert({
            user_id: userId,
            channel: 'email',
            primary_handle: primaryHandle,
            subject,
            status: 'open',
            unread_count: direction === 'inbound' ? 1 : 0,
            last_message_at: sentAt,
            last_message_preview: bodyText.slice(0, 120),
          })
          .select('id')
          .single();
        if (convErr || !newConv) {
          console.error('Create conversation', convErr);
          continue;
        }
        conversationId = newConv.id;
      }

      // Auto-link conversation to People (customers) by strict email match
      try {
        await attemptAutoLink(supabase, conversationId, 'email', primaryHandle);
      } catch (e) {
        console.error('gmail-sync-now: auto-link failed', e);
      }

      const { data: recentMsgs } = await supabase
        .from('inbox_messages')
        .select('id, meta')
        .eq('user_id', userId)
        .eq('channel', 'email')
        .limit(1000);
      const duplicate = (recentMsgs ?? []).find((m: { meta?: { gmail?: { messageId?: string } } }) => (m.meta as { gmail?: { messageId?: string } } | null)?.gmail?.messageId === message.id);
      if (duplicate) continue;

      const { error: insertErr } = await supabase.from('inbox_messages').insert({
        user_id: userId,
        gmail_connection_id: gmailConnectionId,
        conversation_id: conversationId,
        channel: 'email',
        direction,
        from_handle: fromEmail,
        to_handle: toEmail,
        body_text: bodyText,
        sent_at: sentAt,
        status: 'sent',
        meta: { gmail: { messageId: message.id, threadId: message.threadId } },
      });
      if (insertErr) {
        console.error('Insert message', insertErr);
        continue;
      }
      synced++;

      const { data: conv } = await supabase
        .from('inbox_conversations')
        .select('last_message_at, unread_count, status')
        .eq('id', conversationId)
        .single();
      if (conv) {
        const update: Record<string, unknown> = {};
        const lastAt = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
        const msgAt = new Date(sentAt).getTime();
        if (msgAt >= lastAt) {
          update.last_message_at = sentAt;
          update.last_message_preview = bodyText.slice(0, 120);
        }
        if (direction === 'inbound' && conv.status === 'open')
          update.unread_count = (conv.unread_count ?? 0) + 1;
        if (Object.keys(update).length > 0) {
          await supabase.from('inbox_conversations').update(update).eq('id', conversationId);
        }
      }
    } catch (e) {
      console.error('Process message', messageId, e);
    }
  }

  const now = new Date().toISOString();
  await supabase
    .from('gmail_connections')
    .update({ last_synced_at: now, updated_at: now })
    .eq('id', gmailConnectionId);

  return new Response(JSON.stringify({ ok: true, synced }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
