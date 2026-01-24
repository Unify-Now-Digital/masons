import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const twimlEmpty = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const twimlHeaders: Record<string, string> = {
  'Content-Type': 'text/xml; charset=utf-8',
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    console.error('twilio-sms-webhook: failed to read body', e);
    return new Response(twimlEmpty, { status: 200, headers: twimlHeaders });
  }

  const params = new URLSearchParams(rawBody);
  const messageSid = params.get('MessageSid') ?? '';
  const accountSid = params.get('AccountSid') ?? '';
  const from = params.get('From') ?? '';
  const to = params.get('To') ?? '';
  const body = params.get('Body') ?? '';
  const numMedia = params.get('NumMedia') ?? '';
  const messagingServiceSid = params.get('MessagingServiceSid') ?? '';

  if (!messageSid.trim() || !from.trim() || !to.trim()) {
    return new Response(JSON.stringify({ error: 'Missing MessageSid, From, or To' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('twilio-sms-webhook: SUPABASE_URL or SERVICE_ROLE_KEY missing');
    return new Response(twimlEmpty, { status: 200, headers: twimlHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const externalMessageId = `twilio:${messageSid}`;

  const { data: existingMsg } = await supabase
    .from('inbox_messages')
    .select('id')
    .eq('external_message_id', externalMessageId)
    .limit(1)
    .maybeSingle();

  if (existingMsg) {
    return new Response(twimlEmpty, { status: 200, headers: twimlHeaders });
  }

  const canonical = [from.trim(), to.trim()].sort();
  const externalThreadId = canonical.join('|');

  let conversationId: string;

  const { data: existingConv } = await supabase
    .from('inbox_conversations')
    .select('id, last_message_at, unread_count, status')
    .eq('channel', 'sms')
    .eq('external_thread_id', externalThreadId)
    .limit(1)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const sentAt = new Date().toISOString();
    const preview = body.slice(0, 120);
    const { data: newConv, error: createErr } = await supabase
      .from('inbox_conversations')
      .insert({
        channel: 'sms',
        primary_handle: from.trim(),
        external_thread_id: externalThreadId,
        subject: null,
        status: 'open',
        unread_count: 1,
        last_message_at: sentAt,
        last_message_preview: preview,
      })
      .select('id')
      .single();

    if (createErr || !newConv) {
      console.error('twilio-sms-webhook: failed to create conversation', createErr);
      return new Response(twimlEmpty, { status: 200, headers: twimlHeaders });
    }
    conversationId = newConv.id;
  }

  const sentAt = new Date().toISOString();
  const meta: Record<string, unknown> = {
    twilio: {
      MessageSid: messageSid,
      AccountSid: accountSid || undefined,
      From: from,
      To: to,
      NumMedia: numMedia || undefined,
      MessagingServiceSid: messagingServiceSid || undefined,
    },
  };

  const { error: insertErr } = await supabase.from('inbox_messages').insert({
    conversation_id: conversationId,
    channel: 'sms',
    direction: 'inbound',
    from_handle: from.trim(),
    to_handle: to.trim(),
    body_text: body,
    sent_at: sentAt,
    status: 'sent', // (recommended; 'sent' is confusing for inbound)
    external_message_id: externalMessageId,
    meta,
  });


  if (insertErr) {
    console.error('twilio-sms-webhook: failed to insert message', insertErr);
    return new Response(twimlEmpty, { status: 200, headers: twimlHeaders });
  }

  const preview = body.slice(0, 120);
  const updatePayload: Record<string, unknown> = {
    last_message_preview: preview,
    updated_at: sentAt,
  };

  if (existingConv) {
    const prevAt = existingConv.last_message_at ? new Date(existingConv.last_message_at).getTime() : 0;
    if (new Date(sentAt).getTime() > prevAt) {
      updatePayload.last_message_at = sentAt;
    }
    if (existingConv.status === 'open') {
      updatePayload.unread_count = (existingConv.unread_count ?? 0) + 1;
    }
  }

  await supabase
    .from('inbox_conversations')
    .update(updatePayload)
    .eq('id', conversationId);

  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><!-- sms-webhook v2 2026-01-24 --></Response>`,
  { status: 200, headers: twimlHeaders });
});
