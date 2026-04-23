import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-admin-token',
};

interface SendReplyRequest {
  conversation_id: string;
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
    const { conversation_id, body_text }: SendReplyRequest = await req.json();

    const trimmedBody = body_text?.trim?.() ?? '';
    if (!conversation_id || typeof conversation_id !== 'string' || !trimmedBody) {
      return new Response(
        JSON.stringify({ error: 'conversation_id and non-empty body_text are required' }),
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

    // Fetch conversation
    const { data: conversation, error: convError } = await supabase
      .from('inbox_conversations')
      .select('id, channel, primary_handle, subject, organization_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('Conversation not found or error loading conversation', convError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Ensure channel is email
    if (conversation.channel !== 'email') {
      return new Response(
        JSON.stringify({ error: 'Conversation is not an email channel' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Fetch latest Gmail-based message to get threadId
    const { data: messages } = await supabase
      .from('inbox_messages')
      .select('meta')
      .eq('conversation_id', conversation_id)
      .eq('channel', 'email')
      .order('sent_at', { ascending: false })
      .limit(100);

    let threadId: string | null = null;
    let messageId: string | null = null;

    if (messages) {
      for (const msg of messages) {
        const meta = msg.meta as { gmail?: { threadId?: string; messageId?: string } } | null;
        if (meta?.gmail?.threadId) {
          threadId = meta.gmail.threadId;
          messageId = meta.gmail.messageId || null;
          break;
        }
      }
    }

    if (!threadId) {
      return new Response(
        JSON.stringify({ error: 'No Gmail thread found for this conversation' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

    const { data: gmailConn, error: gmailErr } = await supabase
      .from('gmail_connections')
      .select('refresh_token, email_address')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (gmailErr || !gmailConn?.refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No active Gmail connection — reconnect Gmail in settings' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const refreshToken = gmailConn.refresh_token;
    const userEmail = gmailConn.email_address;

    console.log('Gmail credentials check:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!gmailConn.refresh_token,
      refreshTokenLength: gmailConn.refresh_token.length,
      refreshTokenPrefix: gmailConn.refresh_token.substring(0, 10),
      senderEmail: gmailConn.email_address,
    });

    if (!clientId || !clientSecret || !userEmail?.trim()) {
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
      const errorText = await tokenResponse.text();
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

    // Build subject
    let subject = conversation.subject || '(no subject)';
    if (!subject.toLowerCase().startsWith('re:')) {
      subject = `Re: ${subject}`;
    }

    // Build RFC 2822 email
    const emailLines: string[] = [];
    emailLines.push(`From: ${userEmail}`);
    emailLines.push(`To: ${conversation.primary_handle}`);
    emailLines.push(`Subject: ${subject}`);
    
    if (messageId) {
      emailLines.push(`In-Reply-To: <${messageId}>`);
      emailLines.push(`References: <${messageId}>`);
    }
    
    emailLines.push('Content-Type: text/plain; charset=utf-8');
    emailLines.push(''); // Empty line between headers and body
    emailLines.push(trimmedBody);

    const rawEmail = emailLines.join('\r\n');

    // Base64URL encode
    const base64Email = btoa(rawEmail)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail API
    const gmailResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: base64Email,
          threadId: threadId,
        }),
      },
    );

    if (!gmailResponse.ok) {
      const errorText = await gmailResponse.text();
      console.error('Gmail send error', {
        status: gmailResponse.status,
        statusText: gmailResponse.statusText,
      });
      return new Response(
        JSON.stringify({ error: 'Failed to send Gmail reply' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const gmailData = await gmailResponse.json() as GmailSendResponse;
    const sentAt = new Date().toISOString();

    // Insert outbound message
    const { data: message, error: insertError } = await supabase
      .from('inbox_messages')
      .insert({
        conversation_id,
        organization_id: conversation.organization_id,
        channel: 'email',
        direction: 'outbound',
        from_handle: userEmail,
        to_handle: conversation.primary_handle,
        body_text: trimmedBody,
        sent_at: sentAt,
        status: 'sent',
        external_message_id: gmailData.id,
        meta: {
          gmail: {
            messageId: gmailData.id,
            threadId: gmailData.threadId,
          },
        },
      })
      .select()
      .single();

    if (insertError || !message) {
      console.error('Failed to insert outbound inbox_message', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record message in database' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Update conversation metadata
    const { error: updateError } = await supabase
      .from('inbox_conversations')
      .update({
        last_message_at: sentAt,
        last_message_preview: trimmedBody.substring(0, 120),
      })
      .eq('id', conversation_id);

    if (updateError) {
      console.error('Failed to update inbox_conversations metadata', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        gmailMessageId: gmailData.id,
        gmailThreadId: gmailData.threadId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('inbox-gmail-send unexpected error', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
