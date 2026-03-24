import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';
import { decryptSecret } from './whatsappCrypto.ts';
import { resolveWhatsAppRouting } from './whatsappRoutingResolver.ts';

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

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let userId: string | null = null;
  const user = await getUserFromRequest(req);
  if (user) {
    userId = user.id;
  } else {
    const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');
    if (expectedToken && adminToken && adminToken === expectedToken) {
      return jsonResponse(
        { error: 'Use the app to send messages; connect WhatsApp in Profile and sign in.' },
        403
      );
    }
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: SendMessageRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const conversation_id = body.conversation_id;
  const trimmedBody = (body.body_text ?? '').trim();
  if (!conversation_id || typeof conversation_id !== 'string' || !trimmedBody) {
    return jsonResponse(
      { error: 'conversation_id and non-empty body_text are required' },
      400
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: conversation, error: convError } = await supabase
    .from('inbox_conversations')
    .select('id, channel, primary_handle, user_id')
    .eq('id', conversation_id)
    .single();

  if (convError || !conversation) {
    return jsonResponse({ error: 'Conversation not found' }, 404);
  }

  if (conversation.user_id !== userId) {
    return jsonResponse({ error: 'You can only send in your own conversations' }, 403);
  }

  const resolved = await resolveWhatsAppRouting(supabase, userId);
  if (!resolved.ok) {
    const statusCode = resolved.mode === 'managed' ? 409 : 403;
    return jsonResponse(
      {
        error: resolved.error,
        status: resolved.status,
        status_reason_code: resolved.status_reason_code,
        status_reason_message: resolved.status_reason_message,
        action_required: resolved.action_required,
      },
      statusCode,
    );
  }

  let accountSid: string;
  let apiKeySid: string;
  let fromConfigured: string;
  let connectionId: string | null = null;
  let managedConnectionId: string | null = null;
  let whatsappSenderSid: string | null = null;
  let connectionMode: 'manual' | 'managed';
  let apiKeySecret: string | null = null;

  if (resolved.mode === 'managed') {
    connectionMode = 'managed';
    accountSid = resolved.managedConnection.twilio_account_sid ?? '';
    apiKeySid = Deno.env.get('TWILIO_MANAGED_API_KEY_SID') ?? '';
    apiKeySecret = Deno.env.get('TWILIO_MANAGED_API_KEY_SECRET') ?? '';
    fromConfigured = resolved.managedConnection.whatsapp_from_address ?? '';
    managedConnectionId = resolved.managedConnection.id;
    whatsappSenderSid = resolved.managedConnection.twilio_whatsapp_sender_sid ?? null;
    if (!accountSid || !apiKeySid || !apiKeySecret || !fromConfigured) {
      return jsonResponse(
        {
          error: 'managed_whatsapp_not_ready',
          status: 'connected',
          status_reason_code: 'managed_provider_credentials_missing',
          status_reason_message: 'Managed provider credentials are not configured.',
          action_required: true,
        },
        409,
      );
    }
  } else {
    connectionMode = 'manual';
    accountSid = resolved.manualConnection.twilio_account_sid;
    apiKeySid = resolved.manualConnection.twilio_api_key_sid;
    fromConfigured = resolved.manualConnection.whatsapp_from;
    connectionId = resolved.manualConnection.id;
    try {
      apiKeySecret = await decryptSecret(resolved.manualConnection.twilio_api_key_secret_encrypted);
    } catch (e) {
      console.error('inbox-twilio-send: decrypt failed', e);
      return jsonResponse({ error: 'Server error' }, 500);
    }
  }

  const toHandle = conversation.primary_handle;
  const isWhatsApp = conversation.channel === 'whatsapp';
  const fromRaw = (fromConfigured ?? '').trim();
  const fromNumber = isWhatsApp
    ? (fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`)
    : fromRaw.replace(/^whatsapp:/, '');
  const toNumber = isWhatsApp
    ? (toHandle.startsWith('whatsapp:') ? toHandle : `whatsapp:${toHandle}`)
    : toHandle;
  if (!apiKeySecret) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const twilioBody = new URLSearchParams({
    From: fromNumber,
    To: toNumber,
    Body: trimmedBody,
  });

  const twilioResponse = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${apiKeySid}:${apiKeySecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: twilioBody.toString(),
  });

  const sentAt = new Date().toISOString();

  if (!twilioResponse.ok) {
    const errorText = await twilioResponse.text();
    console.error('Twilio API error', { status: twilioResponse.status, body: errorText });

    await supabase.from('inbox_messages').insert({
      conversation_id: conversation.id,
      channel: conversation.channel,
      direction: 'outbound',
      from_handle: 'team',
      to_handle: toHandle,
      body_text: trimmedBody,
      sent_at: sentAt,
      status: 'failed',
      user_id: userId,
      whatsapp_connection_id: connectionId,
      whatsapp_connection_mode: connectionMode,
      whatsapp_managed_connection_id: managedConnectionId,
      whatsapp_sender_sid: whatsappSenderSid,
    });

    return jsonResponse({ error: 'Failed to send message via Twilio' }, 502);
  }

  const twilioData = await twilioResponse.json().catch(() => ({}));

  const { data: message, error: insertError } = await supabase
    .from('inbox_messages')
    .insert({
      conversation_id: conversation.id,
      channel: conversation.channel,
      direction: 'outbound',
      from_handle: 'team',
      to_handle: toHandle,
      body_text: trimmedBody,
      sent_at: sentAt,
      status: 'sent',
      user_id: userId,
      whatsapp_connection_id: connectionId,
      whatsapp_connection_mode: connectionMode,
      whatsapp_managed_connection_id: managedConnectionId,
      whatsapp_sender_sid: whatsappSenderSid,
    })
    .select()
    .single();

  if (insertError || !message) {
    console.error('Failed to insert outbound inbox_message', insertError);
    return jsonResponse({ error: 'Failed to record message in database' }, 500);
  }

  await supabase
    .from('inbox_conversations')
    .update({
      last_message_at: sentAt,
      last_message_preview: trimmedBody.substring(0, 120),
      updated_at: sentAt,
    })
    .eq('id', conversation_id);

  return jsonResponse({
    success: true,
    message_id: message.id,
    twilio_sid: (twilioData?.sid as string | undefined) ?? null,
  }, 200);
});
