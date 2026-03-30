import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { attemptAutoLink } from './autoLinkConversation.ts';

const twimlEmpty = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const twimlHeaders: Record<string, string> = {
  'Content-Type': 'text/xml; charset=utf-8',
};

function normalizeHandle(h: string): string {
  return (h ?? '').trim().replace(/^whatsapp:/i, '');
}

/** Canonical form for matching phone numbers: strip prefix, keep only digits and leading +. */
function normalizePhoneForMatch(handle: string): string {
  const s = (handle ?? '').trim().replace(/^whatsapp:/i, '').trim();
  if (!s) return '';
  const hadLeadingPlus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  return hadLeadingPlus ? `+${digits}` : digits;
}

function detectChannel(rawFrom: string, rawTo: string): 'sms' | 'whatsapp' {
  const rf = (rawFrom ?? '').trim().toLowerCase();
  const rt = (rawTo ?? '').trim().toLowerCase();
  return rf.startsWith('whatsapp:') || rt.startsWith('whatsapp:') ? 'whatsapp' : 'sms';
}

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
  const rawFrom = params.get('From') ?? '';
  const rawTo = params.get('To') ?? '';
  const body = params.get('Body') ?? '';
  const numMedia = params.get('NumMedia') ?? '';
  const messagingServiceSid = params.get('MessagingServiceSid') ?? '';

  const channel = detectChannel(rawFrom, rawTo);
  const from = normalizeHandle(rawFrom);
  const to = normalizeHandle(rawTo);

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

  // Basic debug logging for inbound Twilio payload (no secrets).
  console.log('twilio-sms-webhook: inbound', {
    channel,
    rawFrom,
    rawTo,
    normalizedFrom: from,
    normalizedTo: to,
    accountSid: accountSid ? `${accountSid.substring(0, 6)}…` : null,
  });

  // Route by actual provisioned sender identity.
  // Managed connection lookup is independent from manual user preference;
  // ownership resolution must use Twilio sender/from metadata only.
  let ownerUserId: string | null = null;
  let connectionId: string | null = null;
  let managedConnectionId: string | null = null;
  let connectionMode: 'manual' | 'managed' | null = null;
  let whatsappSenderSid: string | null = null;
  const inboundSenderSid = params.get('ChannelSenderSid') ?? params.get('WaId') ?? '';

  if (channel === 'whatsapp') {
    const phoneForMatch = normalizePhoneForMatch(rawTo);

    // Managed first: deterministic single-row lookup by concrete provisioned identity.
    if (inboundSenderSid) {
      const { data: managedBySid, error: managedBySidErr } = await supabase
        .from('whatsapp_managed_connections')
        .select('id, user_id, twilio_sender')
        .eq('platform_twilio_account_sid', accountSid)
        .eq('twilio_sender', inboundSenderSid)
        .eq('state', 'connected')
        .eq('provider_ready', true)
        .limit(1)
        .maybeSingle();
      if (managedBySidErr) {
        console.error('twilio-sms-webhook: managed sender sid lookup error', managedBySidErr);
      } else if (managedBySid) {
        console.log('twilio-sms-webhook: managed lookup by sender sid matched', {
          accountSid,
          inboundSenderSid,
          managedConnectionId: managedBySid.id,
          ownerUserId: managedBySid.user_id,
        });
        ownerUserId = managedBySid.user_id ?? null;
        managedConnectionId = managedBySid.id ?? null;
        connectionMode = 'managed';
        whatsappSenderSid = managedBySid.twilio_sender ?? inboundSenderSid;
      } else {
        console.log('twilio-sms-webhook: managed lookup by sender sid no match', {
          accountSid,
          inboundSenderSid,
        });
      }
    }

    if (!ownerUserId) {
      const { data: managedByFrom, error: managedByFromErr } = await supabase
        .from('whatsapp_managed_connections')
        .select('id, user_id, twilio_sender')
        .eq('platform_twilio_account_sid', accountSid)
        .eq('display_number', phoneForMatch)
        .eq('state', 'connected')
        .eq('provider_ready', true)
        .limit(1)
        .maybeSingle();
      if (managedByFromErr) {
        console.error('twilio-sms-webhook: managed from lookup error', managedByFromErr);
      } else if (managedByFrom) {
        console.log('twilio-sms-webhook: managed lookup by display_number matched', {
          accountSid,
          normalizedTo: phoneForMatch,
          managedConnectionId: managedByFrom.id,
          ownerUserId: managedByFrom.user_id,
        });
        ownerUserId = managedByFrom.user_id ?? null;
        managedConnectionId = managedByFrom.id ?? null;
        connectionMode = 'managed';
        whatsappSenderSid = managedByFrom.twilio_sender ?? (inboundSenderSid || null);
      } else {
        console.log('twilio-sms-webhook: managed lookup by display_number no match', {
          accountSid,
          normalizedTo: phoneForMatch,
        });
      }
    }

    // Manual legacy lookup only when no managed sender match is found.
    if (!ownerUserId) {
      const { data: connections, error: connError } = await supabase
        .from('whatsapp_connections')
        .select('id, user_id, whatsapp_from')
        .eq('twilio_account_sid', accountSid)
        .eq('status', 'connected');

      if (connError) {
        console.error('twilio-sms-webhook: manual whatsapp_connections lookup error', connError);
      } else {
        const match = (connections ?? []).find(
          (c: { whatsapp_from?: string }) => normalizePhoneForMatch(c.whatsapp_from ?? '') === phoneForMatch,
        );
        if (match) {
          console.log('twilio-sms-webhook: manual fallback matched', {
            accountSid,
            normalizedTo: phoneForMatch,
            manualConnectionId: match.id,
            ownerUserId: match.user_id,
          });
          ownerUserId = match.user_id ?? null;
          connectionId = match.id ?? null;
          connectionMode = 'manual';
        } else {
          console.log('twilio-sms-webhook: manual fallback no match', {
            accountSid,
            normalizedTo: phoneForMatch,
            candidateCount: (connections ?? []).length,
          });
        }
      }
    }

    if (!ownerUserId) {
      console.warn('twilio-sms-webhook: no WhatsApp connection matched', {
        channel,
        rawTo,
        inboundSenderSid,
        normalizedComparisonValue: phoneForMatch,
      });
    }
  } else {
    // Preserve existing SMS behavior: use exact equality on normalized phone for lookup.
    const toForConnection = to.trim();
    const { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('id, user_id')
      .eq('twilio_account_sid', accountSid)
      .eq('whatsapp_from', toForConnection)
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle();

    ownerUserId = connection?.user_id ?? null;
    connectionId = connection?.id ?? null;
    connectionMode = connection ? 'manual' : null;
  }

  if (!ownerUserId) {
    return new Response(twimlEmpty, { status: 200, headers: twimlHeaders });
  }

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

  // Match existing conversation by channel + primary_handle + status + owner (old inbox-twilio-inbound behavior).
  // external_thread_id is still set on new inserts for consistency but not used for inbound lookup.
  const primaryHandle = from.trim();
  let conversationId: string;

  const { data: existingConv } = await supabase
    .from('inbox_conversations')
    .select('id, last_message_at, unread_count, status, user_id')
    .eq('channel', channel)
    .eq('primary_handle', primaryHandle)
    .eq('status', 'open')
    .eq('user_id', ownerUserId)
    .limit(1)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
    if (!existingConv.user_id) {
      await supabase
        .from('inbox_conversations')
        .update({ user_id: ownerUserId })
        .eq('id', conversationId);
    }
  } else {
    const sentAt = new Date().toISOString();
    const preview = body.slice(0, 120);
    const externalThreadId = [primaryHandle, to.trim()].sort().join('|');
    const { data: newConv, error: createErr } = await supabase
      .from('inbox_conversations')
      .insert({
        channel,
        primary_handle: primaryHandle,
        external_thread_id: externalThreadId,
        subject: null,
        status: 'open',
        unread_count: 1,
        last_message_at: sentAt,
        last_message_preview: preview,
        link_state: 'unlinked',
        link_meta: {},
        user_id: ownerUserId,
      })
      .select('id')
      .single();

    if (createErr || !newConv) {
      console.error('twilio-sms-webhook: failed to create conversation', {
        code: createErr?.code,
        message: createErr?.message,
      });
      return new Response(twimlEmpty, { status: 200, headers: twimlHeaders });
    }
    conversationId = newConv.id;
  }

  const sentAt = new Date().toISOString();
  const meta: Record<string, unknown> = {
    twilio: {
      MessageSid: messageSid,
      AccountSid: accountSid || undefined,
      From: rawFrom,
      To: rawTo,
      NumMedia: numMedia || undefined,
      MessagingServiceSid: messagingServiceSid || undefined,
      channel,
    },
  };

  const msgPayload: Record<string, unknown> = {
    conversation_id: conversationId,
    channel,
    direction: 'inbound',
    from_handle: from.trim(),
    to_handle: to.trim(),
    body_text: body,
    sent_at: sentAt,
    status: 'sent',
    external_message_id: externalMessageId,
    meta,
    user_id: ownerUserId,
    whatsapp_connection_mode: connectionMode,
    whatsapp_managed_connection_id: managedConnectionId,
    whatsapp_sender_sid: whatsappSenderSid,
  };
  if (connectionId) msgPayload.whatsapp_connection_id = connectionId;
  const { error: insertErr } = await supabase.from('inbox_messages').insert(msgPayload);

  if (insertErr) {
    console.error('twilio-sms-webhook: failed to insert message', insertErr);
    return new Response(twimlEmpty, { status: 200, headers: twimlHeaders });
  }
  console.log('twilio-sms-webhook: inbound message inserted', {
    conversationId,
    connectionMode,
    managedConnectionId,
    manualConnectionId: connectionId,
    externalMessageId,
  });

  const preview = body.slice(0, 120);
  const updatePayload: Record<string, unknown> = {
    last_message_at: sentAt,
    last_message_preview: preview,
    whatsapp_connection_mode: connectionMode,
    whatsapp_managed_connection_id: managedConnectionId,
  };

  if (existingConv) {
    updatePayload.unread_count = (existingConv.unread_count ?? 0) + 1;
  }

  const { data: updatedConv, error: updateConvErr } = await supabase
    .from('inbox_conversations')
    .update(updatePayload)
    .eq('id', conversationId)
    .select('id')
    .maybeSingle();

  if (updateConvErr) {
    console.error('twilio-sms-webhook: conversation update failed', {
      conversationId,
      message: updateConvErr.message,
    });
  } else if (!updatedConv) {
    console.warn('twilio-sms-webhook: conversation update affected 0 rows', { conversationId });
  }

  // Auto-link conversation to People (customers) by strict phone match (E.164)
  try {
    await attemptAutoLink(supabase, conversationId, channel, from.trim());
  } catch (e) {
    console.error('twilio-sms-webhook: auto-link failed', e);
  }

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><!-- sms/whatsapp-webhook v3 2026-01-31 --></Response>`,
    { status: 200, headers: twimlHeaders },
  );
});
