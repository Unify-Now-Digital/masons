import { getUserFromRequest } from '../_shared/auth.ts';
import {
  ghlFetch,
  getActiveGhlConnectionWithKey,
  requireOrgMember,
  serviceSupabase,
} from '../_shared/ghlClient.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

const ALLOWED_TYPES = new Set(['SMS', 'Email', 'WhatsApp', 'IG', 'FB', 'Live_Chat']);
const PENDING_STALE_MS = 60_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SendBody = {
  organizationId?: string;
  contactId?: string;
  conversationId?: string;
  type?: string;
  message?: string;
  requestId?: string;
};

type IdempotencyRow = {
  request_id: string;
  status: string;
  ghl_message_id: string | null;
  ghl_conversation_id: string | null;
  error_message: string | null;
  created_at: string;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function truncate(s: string, max = 500): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const user = await getUserFromRequest(req);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const organizationId = body.organizationId?.trim();
  const contactId = body.contactId?.trim();
  const conversationId = body.conversationId?.trim();
  const type = body.type?.trim();
  const message = body.message?.trim();
  const requestId = body.requestId?.trim();

  if (!organizationId || !contactId || !conversationId || !type || !message || !requestId) {
    return json(
      {
        ok: false,
        error: 'organizationId, contactId, conversationId, type, message, and requestId are required',
      },
      400,
    );
  }

  if (!message.length) {
    return json({ ok: false, error: 'message cannot be empty or whitespace only' }, 400);
  }

  if (!UUID_RE.test(requestId)) {
    return json({ ok: false, error: 'requestId must be a valid UUID' }, 400);
  }

  if (!ALLOWED_TYPES.has(type)) {
    return json({ ok: false, error: `Unsupported message type: ${type}` }, 400);
  }

  const supabase = serviceSupabase();
  if (!(await requireOrgMember(supabase, user.id, organizationId))) {
    return json({ ok: false, error: 'Forbidden' }, 403);
  }

  let active;
  try {
    active = await getActiveGhlConnectionWithKey(supabase, organizationId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'GHL configuration error';
    return json({ ok: false, error: msg }, 500);
  }
  if (!active) return json({ ok: false, error: 'No GHL connection' }, 404);

  if (!active.connection.outbound_enabled) {
    return json(
      { ok: false, error: 'Outbound messaging is not enabled for this organisation' },
      403,
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from('ghl_send_idempotency')
    .select('request_id, status, ghl_message_id, ghl_conversation_id, error_message, created_at')
    .eq('request_id', requestId)
    .maybeSingle();

  if (existingError) {
    return json({ ok: false, error: 'Idempotency check failed' }, 500);
  }

  const existingRow = existing as IdempotencyRow | null;
  if (existingRow) {
    if (existingRow.status === 'completed') {
      return json({
        ok: true,
        messageId: existingRow.ghl_message_id,
        conversationId: existingRow.ghl_conversation_id ?? conversationId,
        requestId,
        cached: true,
      });
    }
    if (existingRow.status === 'failed') {
      return json(
        {
          ok: false,
          error: 'Request already used; start a new send',
          requestId,
        },
        409,
      );
    }
    const ageMs = Date.now() - new Date(existingRow.created_at).getTime();
    if (existingRow.status === 'pending' && ageMs < PENDING_STALE_MS) {
      return json({ ok: false, error: 'Send already in progress', requestId }, 409);
    }
  }

  if (!existingRow) {
    const { error: insertError } = await supabase.from('ghl_send_idempotency').insert({
      request_id: requestId,
      organization_id: organizationId,
      conversation_id: conversationId,
      contact_id: contactId,
      channel_type: type,
      status: 'pending',
    });
    if (insertError) {
      if (insertError.code === '23505') {
        return json({ ok: false, error: 'Send already in progress', requestId }, 409);
      }
      return json({ ok: false, error: 'Could not record send attempt' }, 500);
    }
  }

  const { apiKey } = active;

// Org-default sender voice — omit userId (spec FR-003).
  // status omitted: GHL rejects/ignores it on send; confirmed via T002 smoke test (201 without it).
  const ghlBody = {
    type,
    contactId,
    conversationId,
    message,
  };

  const ghlRes = await ghlFetch('/conversations/messages', apiKey, {
    method: 'POST',
    body: JSON.stringify(ghlBody),
  });

  const ghlText = await ghlRes.text();
  let ghlJson: unknown = null;
  if (ghlText) {
    try {
      ghlJson = JSON.parse(ghlText);
    } catch {
      ghlJson = null;
    }
  }
  const ghlRecord = asRecord(ghlJson);

  if (!ghlRes.ok) {
    const ghlMessage =
      typeof ghlRecord?.message === 'string'
        ? ghlRecord.message
        : ghlText
          ? truncate(ghlText)
          : `GHL API error (${ghlRes.status})`;
    await supabase
      .from('ghl_send_idempotency')
      .update({
        status: 'failed',
        error_message: truncate(ghlMessage),
        completed_at: new Date().toISOString(),
      })
      .eq('request_id', requestId);

    return json(
      {
        ok: false,
        error: ghlMessage,
        ghlStatus: ghlRes.status,
        ghlMessage,
        requestId,
      },
      ghlRes.status >= 400 && ghlRes.status < 500 ? ghlRes.status : 502,
    );
  }

  const messageId =
    ghlRecord?.messageId != null
      ? String(ghlRecord.messageId)
      : ghlRecord?.id != null
        ? String(ghlRecord.id)
        : null;
  const ghlConversationId =
    ghlRecord?.conversationId != null ? String(ghlRecord.conversationId) : conversationId;

  await supabase
    .from('ghl_send_idempotency')
    .update({
      status: 'completed',
      ghl_message_id: messageId,
      ghl_conversation_id: ghlConversationId,
      completed_at: new Date().toISOString(),
    })
    .eq('request_id', requestId);

  return json({
    ok: true,
    messageId,
    conversationId: ghlConversationId,
    requestId,
  });
});
