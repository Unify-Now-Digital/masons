import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { logManagedConnectionEvent } from './whatsappConnectionEvents.ts';
import { verifyTwilioSignatureForForm } from './twilioSignature.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-provider-token, x-twilio-signature',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const providedToken = req.headers.get('x-provider-token');
  const expectedToken = Deno.env.get('WHATSAPP_MANAGED_PROVIDER_WEBHOOK_TOKEN');
  const hasInternalToken = Boolean(expectedToken && providedToken && providedToken === expectedToken);

  const rawBody = await req.text().catch(() => '');
  const hasValidTwilioSignature = rawBody
    ? await verifyTwilioSignatureForForm(req, rawBody).catch(() => false)
    : false;

  if (!hasInternalToken && !hasValidTwilioSignature) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const payload = (() => {
    if (hasValidTwilioSignature) {
      const p = new URLSearchParams(rawBody);
      const accountSid = p.get('AccountSid');
      const senderSid = p.get('ChannelSenderSid') ?? p.get('WaId');
      const to = p.get('To');
      const eventType = p.get('EventType') ?? 'twilio_webhook';
      const status = p.get('ConnectionStatus') ?? p.get('Status') ?? p.get('SmsStatus');
      const reasonCode = p.get('ErrorCode');
      const reasonMessage = p.get('ErrorMessage');
      const providerReady = status ? ['connected', 'active', 'approved', 'ready'].includes(status.toLowerCase()) : false;
      return {
        account_sid: accountSid,
        twilio_sender: senderSid,
        display_number: to,
        provider_ready: providerReady,
        status: providerReady ? 'connected' : 'pending_provider_review',
        reason_code: reasonCode,
        reason_message: reasonMessage,
        event_type: eventType,
      } as Record<string, unknown>;
    }

    return JSON.parse(rawBody || '{}') as Record<string, unknown>;
  })();

  const connectionId = typeof payload.connection_id === 'string' ? payload.connection_id : null;
  const accountSid = typeof payload.account_sid === 'string' ? payload.account_sid : null;
  const status = typeof payload.status === 'string' ? payload.status : null;
  const senderSid = typeof payload.twilio_sender === 'string' ? payload.twilio_sender : null;
  const fromAddress = typeof payload.display_number === 'string' ? payload.display_number : null;
  const providerReady = payload.provider_ready === true;

  if (!status) return jsonResponse({ error: 'status is required' }, 400);

  const allowed = new Set([
    'provisioning',
    'pending_meta_action',
    'pending_provider_review',
    'action_required',
    'connected',
    'degraded',
    'failed',
    'disconnected',
  ]);
  if (!allowed.has(status)) return jsonResponse({ error: 'Invalid status' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();

  let existing:
    | { id: string; user_id: string; state: string }
    | null = null;

  if (connectionId) {
    const { data, error: readErr } = await supabase
      .from('whatsapp_managed_connections')
      .select('id, user_id, state')
      .eq('id', connectionId)
      .maybeSingle();
    if (readErr) return jsonResponse({ error: 'Failed to load managed connection' }, 500);
    existing = data;
  } else if (hasValidTwilioSignature && accountSid && (senderSid || fromAddress)) {
    let query = supabase
      .from('whatsapp_managed_connections')
      .select('id, user_id, state')
      .eq('platform_twilio_account_sid', accountSid);
    if (senderSid) {
      query = query.eq('twilio_sender', senderSid);
    } else {
      query = query.eq('display_number', fromAddress as string);
    }
    const { data, error: bySenderErr } = await query.limit(1).maybeSingle();
    if (bySenderErr) return jsonResponse({ error: 'Failed to resolve managed connection' }, 500);
    existing = data;
  }

  if (!existing) return jsonResponse({ ok: true, ignored: true });

  const internalProviderConfirmed = hasInternalToken && payload.provider_confirmed === true;
  const canApplyConnectedTransition = hasValidTwilioSignature || internalProviderConfirmed;

  // Internal token path can update non-critical statuses. To mark connected/provider-ready
  // it must explicitly assert provider_confirmed=true and include real sender identity context.
  if (hasInternalToken && !hasValidTwilioSignature && (status === 'connected' || providerReady) && !internalProviderConfirmed) {
    return jsonResponse({ error: 'internal_path_cannot_set_connected_or_provider_ready_without_provider_confirmed' }, 403);
  }

  // Connected transitions require provider-confirmed path and concrete provisioned identity.
  const forceConnected =
    canApplyConnectedTransition &&
    status === 'connected' &&
    providerReady &&
    Boolean(accountSid) &&
    (Boolean(senderSid) || Boolean(fromAddress));
  const nextStatus = forceConnected ? 'connected' : status;
  const nextProviderReady = forceConnected ? true : providerReady;

  const { error: updateErr } = await supabase
    .from('whatsapp_managed_connections')
    .update({
      state: nextStatus,
      provider_ready: nextProviderReady,
      platform_twilio_account_sid: accountSid,
      twilio_sender: senderSid,
      display_number: fromAddress,
      last_error:
        (payload.reason_message as string | undefined) ??
        (payload.status_reason_message as string | undefined) ??
        null,
      meta: payload,
      connected_at: nextStatus === 'connected' ? now : null,
      updated_at: now,
    })
    .eq('id', existing.id);
  if (updateErr) return jsonResponse({ error: 'Failed to update managed connection' }, 500);

  await logManagedConnectionEvent(supabase, {
    managedConnectionId: existing.id,
    userId: existing.user_id,
    actorType: 'provider_webhook',
    eventType: 'provider_status_update',
    previousStatus: existing.state,
    newStatus: nextStatus,
    payload,
  });

  return jsonResponse({ ok: true, connection_id: existing.id, status: nextStatus });
});
