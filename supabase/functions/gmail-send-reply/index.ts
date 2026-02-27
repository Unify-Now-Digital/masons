import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

interface SendBody {
  conversation_id: string;
  message_body: string;
  subject?: string;
}

interface GmailSendResponse {
  id: string;
  threadId: string;
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

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const conversationId = body.conversation_id;
  const messageBody = (body.message_body ?? '').trim();
  if (!conversationId || typeof conversationId !== 'string' || !messageBody) {
    return new Response(
      JSON.stringify({ error: 'conversation_id and non-empty message_body are required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
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
    .select('id, refresh_token, email_address')
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

  const { data: conversation, error: convError } = await supabase
    .from('inbox_conversations')
    .select('id, channel, primary_handle, subject')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (convError || !conversation) {
    return new Response(JSON.stringify({ error: 'Conversation not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (conversation.channel !== 'email') {
    return new Response(JSON.stringify({ error: 'Conversation is not an email channel' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: messages } = await supabase
    .from('inbox_messages')
    .select('meta')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('channel', 'email')
    .order('sent_at', { ascending: false })
    .limit(100);
  let threadId: string | null = null;
  let refMessageId: string | null = null;
  if (messages) {
    for (const msg of messages) {
      const meta = msg.meta as { gmail?: { threadId?: string; messageId?: string } } | null;
      if (meta?.gmail?.threadId) {
        threadId = meta.gmail.threadId;
        refMessageId = meta.gmail.messageId ?? null;
        break;
      }
    }
  }
  if (!threadId) {
    return new Response(JSON.stringify({ error: 'No Gmail thread found for this conversation' }), {
      status: 400,
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
    console.error('Gmail token refresh failed', tokenRes.status, errText);
    return new Response(JSON.stringify({ error: 'Failed to authenticate with Gmail' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const tokenData = (await tokenRes.json()) as { access_token: string };
  const accessToken = tokenData.access_token;

  let subject = (body.subject ?? conversation.subject ?? '(no subject)').trim();
  if (!subject.toLowerCase().startsWith('re:')) subject = `Re: ${subject}`;
  const emailLines: string[] = [
    `From: ${userEmail}`,
    `To: ${conversation.primary_handle}`,
    `Subject: ${subject}`,
  ];
  if (refMessageId) {
    emailLines.push(`In-Reply-To: <${refMessageId}>`);
    emailLines.push(`References: <${refMessageId}>`);
  }
  emailLines.push('Content-Type: text/plain; charset=utf-8');
  emailLines.push('');
  emailLines.push(messageBody);
  const rawEmail = emailLines.join('\r\n');
  const base64Email = btoa(rawEmail).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64Email, threadId }),
  });
  if (!gmailRes.ok) {
    const errText = await gmailRes.text();
    console.error('Gmail send error', gmailRes.status, errText);
    return new Response(JSON.stringify({ error: 'Failed to send Gmail reply' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const gmailData = (await gmailRes.json()) as GmailSendResponse;
  const sentAt = new Date().toISOString();

  const { data: insertedMessage, error: insertErr } = await supabase
    .from('inbox_messages')
    .insert({
      user_id: userId,
      gmail_connection_id: gmailConnectionId,
      conversation_id: conversationId,
      channel: 'email',
      direction: 'outbound',
      from_handle: userEmail,
      to_handle: conversation.primary_handle,
      body_text: messageBody,
      sent_at: sentAt,
      status: 'sent',
      meta: { gmail: { messageId: gmailData.id, threadId: gmailData.threadId } },
    })
    .select('id')
    .single();
  if (insertErr || !insertedMessage) {
    console.error('Insert outbound message', insertErr);
    return new Response(JSON.stringify({ error: 'Failed to record message' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await supabase
    .from('inbox_conversations')
    .update({
      last_message_at: sentAt,
      last_message_preview: messageBody.slice(0, 120),
      updated_at: sentAt,
    })
    .eq('id', conversationId);

  return new Response(
    JSON.stringify({ ok: true, message_id: insertedMessage.id }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
