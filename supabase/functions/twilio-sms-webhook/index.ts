import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { attemptAutoLink } from '../_shared/autoLinkConversation.ts';
import { resolveOrganizationIdForUser } from '../_shared/organizationMembership.ts';
import { normalizePhoneForMatch } from '../_shared/phoneNormalization.ts';
import { verifyTwilioSignatureForForm } from '../_shared/twilioSignature.ts';

const twimlEmpty = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const twimlHeaders: Record<string, string> = {
  'Content-Type': 'text/xml; charset=utf-8',
};

function normalizeHandle(h: string): string {
  return (h ?? '').trim().replace(/^whatsapp:/i, '');
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

  // Diagnostic fields cover the three failure modes: missing header, missing/wrong token,
  // URL-base mismatch. Never log the body.
  if (!(await verifyTwilioSignatureForForm(req, rawBody))) {
    console.warn('twilio-sms-webhook: X-Twilio-Signature validation failed', {
      from: params.get('From') ?? '',
      to: params.get('To') ?? '',
      hasSignatureHeader: req.headers.has('X-Twilio-Signature') || req.headers.has('x-twilio-signature'),
      authTokenConfigured: Boolean(Deno.env.get('TWILIO_AUTH_TOKEN')),
      publicUrlConfigured: Boolean(Deno.env.get('TWILIO_WEBHOOK_URL')),
      reqUrl: req.url,
    });
    return new Response('Forbidden', { status: 403 });
  }

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
  let connectionOrganizationId: string | null = null;
  const inboundSenderSid = params.get('ChannelSenderSid') ?? params.get('WaId') ?? '';

  if (channel === 'whatsapp') {
    const phoneForMatch = normalizePhoneForMatch(rawTo);

    // Managed first: deterministic single-row lookup by concrete provisioned identity.
    if (inboundSenderSid) {
      const { data: managedBySid, error: managedBySidErr } = await supabase
        .from('whatsapp_managed_connections')
        .select('id, user_id, twilio_sender, organization_id')
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
        connectionOrganizationId = (managedBySid as { organization_id?: string }).organization_id ?? null;
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
        .select('id, user_id, twilio_sender, organization_id')
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
        connectionOrganizationId = (managedByFrom as { organization_id?: string }).organization_id ?? null;
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
        .select('id, user_id, whatsapp_from, organization_id')
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
          connectionOrganizationId = (match as { organization_id?: string }).organization_id ?? null;
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
      .select('id, user_id, organization_id')
      .eq('twilio_account_sid', accountSid)
      .eq('whatsapp_from', toForConnection)
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle();

    ownerUserId = connection?.user_id ?? null;
    connectionId = connection?.id ?? null;
    connectionOrganizationId = (connection as { organization_id?: string } | null)?.organization_id ?? null;
    connectionMode = connection ? 'manual' : null;
  }

  if (!ownerUserId) {
    return new Response(twimlEmpty, { status: 200, headers: twimlHeaders });
  }

  const tenantOrgId = await resolveOrganizationIdForUser(
    supabase,
    ownerUserId,
    connectionOrganizationId,
  );
  if (!tenantOrgId) {
    console.warn('twilio-sms-webhook: no organization for user', { ownerUserId });
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

  // Two-stage, org-scoped conversation match.
  // Stage 1: deterministic thread-key lookup. The key mirrors inbox-twilio-send's first-send
  // stamp: both counterpart numbers canonicalized, sorted, |-joined.
  // Stage 2: legacy rows without a thread key — normalized primary_handle match in code.
  const primaryHandle = from.trim();
  const normalizedFrom = normalizePhoneForMatch(rawFrom);
  const normalizedTo = normalizePhoneForMatch(rawTo);
  // Alphanumeric SMS sender IDs normalize to '' — fall back to the trimmed raw handle so the
  // key stays unique and empty-vs-empty comparisons can't merge unrelated senders.
  const keyFrom = normalizedFrom || primaryHandle;
  const keyTo = normalizedTo || to.trim();
  const threadKey = [keyFrom, keyTo].sort().join('|');
  let conversationId: string;

  const convSelect =
    'id, last_message_at, unread_count, user_id, external_thread_id, whatsapp_connection_mode, primary_handle';
  type ConvRow = {
    id: string;
    last_message_at: string | null;
    unread_count: number | null;
    user_id: string | null;
    external_thread_id: string | null;
    whatsapp_connection_mode: string | null;
    primary_handle: string | null;
  };
  let existingConv: ConvRow | null = null;

  const { data: convByThread, error: threadLookupErr } = await supabase
    .from('inbox_conversations')
    .select(convSelect)
    .eq('channel', channel)
    .eq('external_thread_id', threadKey)
    .eq('organization_id', tenantOrgId)
    .eq('status', 'open')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (threadLookupErr) {
    console.error('twilio-sms-webhook: thread-key conversation lookup error', threadLookupErr);
  } else if (convByThread) {
    existingConv = convByThread as ConvRow;
  }

  if (!existingConv) {
    const { data: openConvs, error: fallbackLookupErr } = await supabase
      .from('inbox_conversations')
      .select(convSelect)
      .eq('organization_id', tenantOrgId)
      .eq('channel', channel)
      .eq('status', 'open');
    if (fallbackLookupErr) {
      console.error('twilio-sms-webhook: fallback conversation lookup error', fallbackLookupErr);
    } else {
      const candidates = ((openConvs ?? []) as ConvRow[]).filter((c) =>
        normalizedFrom
          ? normalizePhoneForMatch(c.primary_handle ?? '') === normalizedFrom
          : (c.primary_handle ?? '').trim() === primaryHandle,
      );
      candidates.sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''));
      existingConv = candidates[0] ?? null;
      if (existingConv && candidates.length > 1) {
        console.warn('twilio-sms-webhook: multiple open conversations matched handle, using most recent', {
          matchedConversationId: existingConv.id,
          candidateCount: candidates.length,
        });
      }
    }
  }

  if (existingConv) {
    conversationId = existingConv.id;
    // Backfill legacy rows so the next inbound resolves via the stage-1 thread-key lookup.
    const convUpdates: Record<string, unknown> = {};
    if (!existingConv.external_thread_id) convUpdates.external_thread_id = threadKey;
    if (!existingConv.user_id) convUpdates.user_id = ownerUserId;
    if (!existingConv.whatsapp_connection_mode && connectionMode) {
      convUpdates.whatsapp_connection_mode = connectionMode;
    }
    if (Object.keys(convUpdates).length > 0) {
      const { error: backfillErr } = await supabase
        .from('inbox_conversations')
        .update(convUpdates)
        .eq('id', conversationId);
      if (backfillErr) {
        console.error('twilio-sms-webhook: conversation backfill failed', {
          conversationId,
          message: backfillErr.message,
        });
      }
    }
  } else {
    const sentAt = new Date().toISOString();
    const preview = body.slice(0, 120);
    const externalThreadId = threadKey;
    const { data: newConv, error: createErr } = await supabase
      .from('inbox_conversations')
      .insert({
        organization_id: tenantOrgId,
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
    organization_id: tenantOrgId,
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
