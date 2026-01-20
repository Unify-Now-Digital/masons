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
    // Validate admin token (JWT is effectively OFF; we rely on this shared secret)
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

    const { conversation_id, body_text }: SendMessageRequest = await req.json();

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

    // Load conversation (channel, primary_handle)
    const { data: conversation, error: convError } = await supabase
      .from('inbox_conversations')
      .select('id, channel, primary_handle')
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

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Twilio credentials not configured (SID/Token/Number missing)');
      return new Response(
        JSON.stringify({ error: 'Twilio not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Determine Twilio From/To formatting based on channel
    const toHandle: string = conversation.primary_handle;
    const isWhatsApp = conversation.channel === 'whatsapp';

    const fromNumber = isWhatsApp
      ? `whatsapp:${twilioPhoneNumber}`
      : twilioPhoneNumber;
    const toNumber = isWhatsApp
      ? `whatsapp:${toHandle}`
      : toHandle;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;

    const body = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: trimmedBody,
    });

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const sentAt = new Date().toISOString();

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error('Twilio API error', {
        status: twilioResponse.status,
        statusText: twilioResponse.statusText,
        body: errorText,
      });

      // Insert failed message for audit trail
      await supabase.from('inbox_messages').insert({
        conversation_id,
        channel: conversation.channel,
        direction: 'outbound',
        from_handle: 'team',
        to_handle: conversation.primary_handle,
        body_text: trimmedBody,
        subject: null,
        sent_at: sentAt,
        status: 'failed',
      });

      return new Response(
        JSON.stringify({ error: 'Failed to send message via Twilio' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const twilioData = await twilioResponse.json().catch(() => ({}));

    const { data: message, error: insertError } = await supabase
      .from('inbox_messages')
      .insert({
        conversation_id,
        channel: conversation.channel,
        direction: 'outbound',
        from_handle: 'team',
        to_handle: conversation.primary_handle,
        body_text: trimmedBody,
        subject: null,
        sent_at: sentAt,
        status: 'sent',
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

    const { error: updateError } = await supabase
      .from('inbox_conversations')
      .update({
        last_message_at: sentAt,
        last_message_preview: trimmedBody.substring(0, 120),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation_id);

    if (updateError) {
      console.error('Failed to update inbox_conversations metadata', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: message.id,
        twilio_sid: (twilioData && (twilioData.sid as string | undefined)) ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('inbox-twilio-send unexpected error', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

