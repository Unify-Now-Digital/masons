import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { attemptAutoLink } from './autoLinkConversation.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-admin-token',
};

interface NewThreadRequest {
  to: string;
  subject: string;
  body_text: string;
}

interface GmailSendResponse {
  id: string;
  threadId: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Validate admin token
    const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');

    if (!expectedToken || !adminToken || adminToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Parse request body
    const { to, subject, body_text }: NewThreadRequest = await req.json();

    const trimmedTo = to?.trim?.() ?? '';
    const trimmedSubject = subject?.trim?.() ?? '';
    const trimmedBody = body_text?.trim?.() ?? '';

    if (!trimmedTo || !trimmedSubject || !trimmedBody) {
      return new Response(
        JSON.stringify({ error: 'to, subject, and body_text are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Supabase URL or SERVICE_ROLE_KEY missing');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load Gmail secrets
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');
    const userEmail = Deno.env.get('GMAIL_USER_EMAIL');

    if (!clientId || !clientSecret || !refreshToken || !userEmail) {
      console.error('Gmail credentials missing');
      return new Response(
        JSON.stringify({ error: 'Gmail not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Get access token via refresh token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Gmail OAuth error', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
      });
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with Gmail' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Build RFC 2822 email (new thread — no In-Reply-To or References)
    const emailLines: string[] = [];
    emailLines.push(`From: ${userEmail}`);
    emailLines.push(`To: ${trimmedTo}`);
    emailLines.push(`Subject: ${trimmedSubject}`);
    emailLines.push('Content-Type: text/plain; charset=utf-8');
    emailLines.push(''); // Empty line separating headers from body
    emailLines.push(trimmedBody);

    const rawEmail = emailLines.join('\r\n');

    // Base64URL encode
    const base64Email = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail API (no threadId = new thread)
    const gmailResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: base64Email }),
      },
    );

    if (!gmailResponse.ok) {
      console.error('Gmail send error', {
        status: gmailResponse.status,
        statusText: gmailResponse.statusText,
      });
      return new Response(
        JSON.stringify({ error: 'Failed to send email via Gmail' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const gmailData = await gmailResponse.json() as GmailSendResponse;
    const sentAt = new Date().toISOString();

    // Create inbox_conversation for the outbound thread
    const { data: conversation, error: convError } = await supabase
      .from('inbox_conversations')
      .insert({
        channel: 'email',
        primary_handle: trimmedTo,
        subject: trimmedSubject,
        status: 'open',
        unread_count: 0,
        last_message_at: sentAt,
        last_message_preview: trimmedBody.substring(0, 120),
        external_thread_id: `gmail:${gmailData.threadId}`,
      })
      .select('id')
      .single();

    if (convError || !conversation) {
      console.error('Failed to create inbox_conversation', convError);
      return new Response(
        JSON.stringify({ error: 'Email sent but failed to record conversation' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Auto-link conversation to People (customers) by strict email match
    try {
      await attemptAutoLink(supabase, conversation.id, 'email', trimmedTo);
    } catch (e) {
      console.error('inbox-gmail-new-thread: auto-link failed', e);
    }

    // Insert outbound message
    const { error: msgError } = await supabase
      .from('inbox_messages')
      .insert({
        conversation_id: conversation.id,
        channel: 'email',
        direction: 'outbound',
        from_handle: userEmail,
        to_handle: trimmedTo,
        body_text: trimmedBody,
        subject: trimmedSubject,
        sent_at: sentAt,
        status: 'sent',
        external_message_id: `gmail:${gmailData.id}`,
        meta: {
          gmail: {
            messageId: gmailData.id,
            threadId: gmailData.threadId,
          },
        },
      });

    if (msgError) {
      console.error('Failed to insert inbox_message', msgError);
      // Non-fatal: email was sent and conversation created
    }

    return new Response(
      JSON.stringify({
        success: true,
        gmailMessageId: gmailData.id,
        gmailThreadId: gmailData.threadId,
        conversationId: conversation.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('inbox-gmail-new-thread unexpected error', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
