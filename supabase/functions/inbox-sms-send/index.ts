import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-admin-token',
};

interface SendMessageRequest {
  conversation_id: string;
  body_text: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');
    if (!expectedToken || !adminToken || adminToken !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: SendMessageRequest;
    try {
      body = (await req.json()) as SendMessageRequest;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const conversationId = body?.conversation_id;
    const bodyText = body?.body_text;
    const trimmedBody = typeof bodyText === 'string' ? bodyText.trim() : '';
    if (!conversationId || typeof conversationId !== 'string' || !trimmedBody) {
      return new Response(
        JSON.stringify({ error: 'conversation_id and non-empty body_text are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('inbox-sms-send: SUPABASE_URL or SERVICE_ROLE_KEY missing');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: conversation, error: convError } = await supabase
      .from('inbox_conversations')
      .select('id, channel, primary_handle')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (conversation.channel !== 'sms') {
      return new Response(
        JSON.stringify({ error: 'Conversation channel must be sms' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('inbox-sms-send: Twilio credentials missing');
      return new Response(JSON.stringify({ error: 'Twilio not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioBody = new URLSearchParams({
      From: twilioPhoneNumber,
      To: conversation.primary_handle,
      Body: trimmedBody,
    });

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: twilioBody.toString(),
    });

    const sentAt = new Date().toISOString();

    if (!twilioResponse.ok) {
      const errText = await twilioResponse.text();
      console.error('inbox-sms-send: Twilio API error', {
        status: twilioResponse.status,
        body: errText,
      });

      await supabase.from('inbox_messages').insert({
        conversation_id: conversationId,
        channel: 'sms',
        direction: 'outbound',
        from_handle: twilioPhoneNumber,
        to_handle: conversation.primary_handle,
        body_text: trimmedBody,
        sent_at: sentAt,
        status: 'sent',
      });

      return new Response(
        JSON.stringify({ error: 'Failed to send message via Twilio' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const twilioData = (await twilioResponse.json().catch(() => ({}))) as { sid?: string };
    const messageSid = twilioData?.sid ?? null;
    const externalMessageId = messageSid ? `twilio:${messageSid}` : `twilio:local:${crypto.randomUUID()}`;

    const { data: message, error: insertError } = await supabase
      .from('inbox_messages')
      .insert({
        conversation_id: conversationId,
        channel: 'sms',
        direction: 'outbound',
        from_handle: twilioPhoneNumber,
        to_handle: conversation.primary_handle,
        body_text: trimmedBody,
        sent_at: sentAt,
        status: 'sent',
        external_message_id: externalMessageId,
        meta: messageSid
          ? {
              twilio: {
                MessageSid: messageSid,
                AccountSid: twilioAccountSid,
                To: conversation.primary_handle,
              },
            }
          : null,
      })
      .select('id')
      .single();

    if (insertError || !message) {
      console.error('inbox-sms-send: failed to insert outbound message', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record message in database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await supabase
      .from('inbox_conversations')
      .update({
        last_message_at: sentAt,
        last_message_preview: trimmedBody.slice(0, 120),
        updated_at: sentAt,
      })
      .eq('id', conversationId);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: message.id,
        twilio_sid: messageSid,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('inbox-sms-send unexpected error', e);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
