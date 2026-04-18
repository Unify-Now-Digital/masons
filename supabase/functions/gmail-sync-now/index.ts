import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { extractBodyHtml, extractBodyText } from './gmailBody.ts';
import { getUserFromRequest } from './auth.ts';
import { attemptAutoLink } from './autoLinkConversation.ts';
import { resolveOrganizationIdForUser } from './organizationMembership.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

/** Cap total listed IDs per sync to bound runtime (Gmail returns max 100 per page). Shared across INBOX + SENT. */
const MAX_MESSAGES_LISTED_PER_SYNC = 500;

interface SyncBody {
  since?: string;
}

interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId?: string }>;
  nextPageToken?: string;
}

interface GmailThreadResponse {
  messages?: GmailMessageResponse[];
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
    .select('id, refresh_token, email_address, last_synced_at, organization_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (connError || !connection) {
    return new Response(JSON.stringify({ error: 'No Gmail connection' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const tenantOrgId = await resolveOrganizationIdForUser(
    supabase,
    userId,
    connection.organization_id,
  );
  if (!tenantOrgId) {
    return new Response(JSON.stringify({ error: 'No organization membership' }), {
      status: 403,
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
  const baseParams = new URLSearchParams({ maxResults: '100' });
  if (body.since) {
    const sec = Math.floor(new Date(body.since).getTime() / 1000);
    baseParams.set('q', `after:${sec}`);
  } else if (connection.last_synced_at) {
    const sec = Math.floor(new Date(connection.last_synced_at).getTime() / 1000);
    baseParams.set('q', `after:${sec}`);
  } else {
    baseParams.set('q', 'newer_than:30d');
  }

  const listBudget = { remaining: MAX_MESSAGES_LISTED_PER_SYNC };
  const seenMessageIds = new Set<string>();

  const collectMessageIdsForLabel = async (labelId: string, out: Array<{ id: string }>): Promise<void> => {
    const queryParams = new URLSearchParams(baseParams);
    queryParams.set('labelIds', labelId);
    let listPageToken: string | undefined;
    do {
      const pageParams = new URLSearchParams(queryParams);
      if (listPageToken) pageParams.set('pageToken', listPageToken);

      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${pageParams.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!listRes.ok) {
        const errText = await listRes.text();
        console.error('Gmail messages.list error', labelId, listRes.status, errText);
        throw new Error(`messages.list failed for ${labelId}`);
      }
      const list = (await listRes.json()) as GmailMessageListResponse;
      for (const m of list.messages ?? []) {
        if (listBudget.remaining <= 0) return;
        if (seenMessageIds.has(m.id)) continue;
        seenMessageIds.add(m.id);
        out.push({ id: m.id });
        listBudget.remaining -= 1;
      }
      listPageToken = list.nextPageToken;
      if (listBudget.remaining <= 0) break;
    } while (listPageToken);
  };

  let synced = 0;
  /** One full-thread import per Gmail thread per sync (list can return many rows for the same thread). */
  const threadIdsExpandedThisRun = new Set<string>();

  const extractEmail = (h: string) => (h.match(/<(.+?)>/) ?? [null, h.trim()])[1] ?? h.trim();

  async function bumpConversationSummary(
    conversationId: string,
    sentAt: string,
    bodyText: string,
    direction: 'inbound' | 'outbound',
  ): Promise<void> {
    const { data: conv } = await supabase
      .from('inbox_conversations')
      .select('last_message_at, unread_count, status')
      .eq('id', conversationId)
      .single();
    if (!conv) return;
    const update: Record<string, unknown> = {};
    const lastAt = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
    const msgAt = new Date(sentAt).getTime();
    if (msgAt >= lastAt) {
      update.last_message_at = sentAt;
      update.last_message_preview = bodyText.slice(0, 120);
    }
    if (direction === 'inbound' && conv.status === 'open') {
      update.unread_count = (conv.unread_count ?? 0) + 1;
    }
    if (Object.keys(update).length > 0) {
      await supabase.from('inbox_conversations').update(update).eq('id', conversationId);
    }
  }

  /** Inserts one Gmail message from INBOX/thread path if not already stored. */
  async function ingestGmailMessage(message: GmailMessageResponse): Promise<boolean> {
    const { data: dupRow } = await supabase
      .from('inbox_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('channel', 'email')
      .eq('gmail_connection_id', gmailConnectionId)
      .eq('external_message_id', message.id)
      .maybeSingle();
    if (dupRow) return false;

    const headers = message.payload.headers;
    const getHeader = (n: string) => headers.find((h) => h.name === n)?.value ?? '';
    const fromHeader = getHeader('From');
    const toHeader = getHeader('To');
    const subjectHeader = getHeader('Subject');
    const dateHeader = getHeader('Date');
    const fromEmail = extractEmail(fromHeader);
    const toEmail = extractEmail(toHeader);
    const subject = subjectHeader.trim() ? subjectHeader.trim() : null;
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
    const bodyHtml = extractBodyHtml(message.payload);
    if (!bodyText) bodyText = message.snippet ?? '';

    const debugMessageId = Deno.env.get('GMAIL_DEBUG_MESSAGE_ID');
    if (debugMessageId && message.id === debugMessageId) {
      const payload = message.payload;
      const getDbgHeader = (name: string) =>
        payload.headers?.find((h: { name: string; value: string }) => h.name === name)?.value ?? '';
      const partHeader = (part: { headers?: Array<{ name: string; value: string }> }, name: string) =>
        part.headers?.find((h: { name: string; value: string }) => h.name === name)?.value ?? '';
      const payloadWithMime = payload as { mimeType?: string; headers?: Array<{ name: string; value: string }> };
      const payloadSummary = {
        mimeType: payloadWithMime.mimeType,
        hasPayloadBodyData: !!payload.body?.data,
        contentTransferEncoding: getDbgHeader('Content-Transfer-Encoding'),
        contentType: getDbgHeader('Content-Type'),
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
        (r: { meta?: unknown }) => (r.meta as { gmail?: { messageId?: string } } | null)?.gmail?.messageId === message.id,
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

    const { data: convByThread } = await supabase
      .from('inbox_conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('channel', 'email')
      .eq('organization_id', tenantOrgId)
      .eq('external_thread_id', message.threadId)
      .maybeSingle();

    let conversationId: string;
    if (convByThread?.id) {
      conversationId = convByThread.id;
    } else {
      const { data: existingMsgs } = await supabase
        .from('inbox_messages')
        .select('conversation_id, meta')
        .eq('user_id', userId)
        .eq('channel', 'email')
        .limit(2000);
      const byThread = (existingMsgs ?? []).find(
        (m: { meta?: { gmail?: { threadId?: string } }; conversation_id: string }) =>
          (m.meta as { gmail?: { threadId?: string } } | null)?.gmail?.threadId === message.threadId,
      );
      if (byThread) {
        conversationId = (byThread as { conversation_id: string }).conversation_id;
        await supabase
          .from('inbox_conversations')
          .update({ external_thread_id: message.threadId })
          .eq('id', conversationId)
          .is('external_thread_id', null);
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from('inbox_conversations')
          .insert({
            user_id: userId,
            organization_id: tenantOrgId,
            channel: 'email',
            primary_handle: primaryHandle,
            subject,
            status: 'open',
            unread_count: direction === 'inbound' ? 1 : 0,
            last_message_at: sentAt,
            last_message_preview: bodyText.slice(0, 120),
            external_thread_id: message.threadId,
          })
          .select('id')
          .single();
        if (convErr || !newConv) {
          console.error('Create conversation', convErr);
          return false;
        }
        conversationId = newConv.id;
      }
    }

    try {
      await attemptAutoLink(supabase, conversationId, 'email', primaryHandle);
    } catch (e) {
      console.error('gmail-sync-now: auto-link failed', e);
    }

    const metaGmail = { messageId: message.id, threadId: message.threadId };
    const { error: insertErr } = await supabase.from('inbox_messages').insert({
      user_id: userId,
      organization_id: tenantOrgId,
      gmail_connection_id: gmailConnectionId,
      conversation_id: conversationId,
      channel: 'email',
      direction,
      from_handle: fromEmail,
      to_handle: toEmail,
      subject,
      body_text: bodyText,
      body_html: bodyHtml || null,
      sent_at: sentAt,
      status: 'sent',
      external_message_id: message.id,
      meta: { gmail: metaGmail },
    });
    if (insertErr) {
      console.error('Insert message', insertErr);
      return false;
    }

    await bumpConversationSummary(conversationId, sentAt, bodyText, direction);
    return true;
  }

  /** Inserts one outbound Gmail message from SENT label when a conversation exists for the thread. */
  async function ingestSentOutbound(message: GmailMessageResponse): Promise<boolean> {
    const { data: dupRow } = await supabase
      .from('inbox_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('channel', 'email')
      .eq('gmail_connection_id', gmailConnectionId)
      .eq('external_message_id', message.id)
      .maybeSingle();
    if (dupRow) return false;

    const headers = message.payload.headers;
    const getHeader = (n: string) => headers.find((h) => h.name === n)?.value ?? '';
    const toHeader = getHeader('To');
    const subjectHeader = getHeader('Subject');
    const dateHeader = getHeader('Date');
    const toEmail = extractEmail(toHeader);
    const subject = subjectHeader.trim() ? subjectHeader.trim() : null;
    let sentAt: string;
    try {
      const d = new Date(dateHeader);
      sentAt = !isNaN(d.getTime()) ? d.toISOString() : new Date(parseInt(message.internalDate)).toISOString();
    } catch {
      sentAt = new Date().toISOString();
    }
    let bodyText = extractBodyText(message.payload);
    const bodyHtml = extractBodyHtml(message.payload);
    if (!bodyText) bodyText = message.snippet ?? '';

    const { data: convByThread, error: convLookupErr } = await supabase
      .from('inbox_conversations')
      .select('id, primary_handle')
      .eq('user_id', userId)
      .eq('organization_id', tenantOrgId)
      .eq('channel', 'email')
      .eq('external_thread_id', message.threadId)
      .maybeSingle();
    if (convLookupErr) {
      console.error('gmail-sync-now: SENT conversation lookup failed', convLookupErr);
      return false;
    }

    let conv = convByThread;
    if (!conv) {
      // New outbound thread started from Gmail web — create conversation
      const { data: newConv, error: convErr } = await supabase
        .from('inbox_conversations')
        .insert({
          user_id: userId,
          organization_id: tenantOrgId,
          channel: 'email',
          primary_handle: toEmail,
          subject,
          status: 'open',
          unread_count: 0,
          last_message_at: sentAt,
          last_message_preview: bodyText.slice(0, 120),
          external_thread_id: message.threadId,
          gmail_connection_id: gmailConnectionId,
        })
        .select('id, primary_handle')
        .single();

      if (convErr || !newConv) {
        console.error('gmail-sync-now: Failed to create conversation for SENT orphan', convErr);
        return false;
      }

      // Use the newly created conversation
      conv = newConv;
    }

    const conversationId = conv.id;
    const primaryHandle = conv.primary_handle;

    const fromEmail = userEmail;
    const normalizedToEmail = primaryHandle;

    try {
      await attemptAutoLink(supabase, conversationId, 'email', normalizedToEmail);
    } catch (e) {
      console.error('gmail-sync-now: auto-link failed', e);
    }

    const metaGmail = { messageId: message.id, threadId: message.threadId };
    const { error: insertErr } = await supabase.from('inbox_messages').insert({
      user_id: userId,
      organization_id: tenantOrgId,
      gmail_connection_id: gmailConnectionId,
      conversation_id: conversationId,
      channel: 'email',
      direction: 'outbound',
      from_handle: fromEmail,
      to_handle: normalizedToEmail,
      subject,
      body_text: bodyText,
      body_html: bodyHtml || null,
      sent_at: sentAt,
      status: 'sent',
      external_message_id: message.id,
      meta: { gmail: metaGmail },
    });
    if (insertErr) {
      console.error('Insert SENT message', insertErr);
      return false;
    }

    await bumpConversationSummary(conversationId, sentAt, bodyText, 'outbound');
    return true;
  }

  const inboxIds: Array<{ id: string }> = [];
  try {
    await collectMessageIdsForLabel('INBOX', inboxIds);
  } catch (e) {
    console.error('gmail-sync-now: INBOX list failed', e);
    return new Response(JSON.stringify({ error: 'Failed to fetch Gmail messages' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  for (const { id: messageId } of inboxIds) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!msgRes.ok) continue;
      const message = (await msgRes.json()) as GmailMessageResponse;

      if (threadIdsExpandedThisRun.has(message.threadId)) {
        continue;
      }
      threadIdsExpandedThisRun.add(message.threadId);

      let batch: GmailMessageResponse[];
      const threadRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(message.threadId)}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (threadRes.ok) {
        const threadJson = (await threadRes.json()) as GmailThreadResponse;
        const msgs = threadJson.messages ?? [];
        batch = msgs.slice().sort((a, b) => parseInt(a.internalDate, 10) - parseInt(b.internalDate, 10));
      } else {
        batch = [message];
      }

      for (const msg of batch) {
        if (await ingestGmailMessage(msg)) synced += 1;
      }
    } catch (e) {
      console.error('Process message', messageId, e);
    }
  }

  let sentPassFailed = false;
  try {
    const sentIds: Array<{ id: string }> = [];
    await collectMessageIdsForLabel('SENT', sentIds);
    for (const { id: messageId } of sentIds) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!msgRes.ok) continue;
        const message = (await msgRes.json()) as GmailMessageResponse;
        if (await ingestSentOutbound(message)) synced += 1;
      } catch (e) {
        console.error('gmail-sync-now: SENT message error', messageId, e);
      }
    }
  } catch (e) {
    console.error('gmail-sync-now: SENT pass failed', e);
    sentPassFailed = true;
  }

  if (!sentPassFailed) {
    const now = new Date().toISOString();
    await supabase
      .from('gmail_connections')
      .update({ last_synced_at: now, updated_at: now })
      .eq('id', gmailConnectionId);
  }

  return new Response(JSON.stringify({ ok: true, synced }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
