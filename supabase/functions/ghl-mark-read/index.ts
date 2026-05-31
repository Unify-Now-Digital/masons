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

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const READ_STATUSES = new Set(['read', 'opened']);

async function cheapMarkRead(conversationId: string, apiKey: string): Promise<{ ok: boolean; status: number }> {
  const res = await ghlFetch(`/conversations/${encodeURIComponent(conversationId)}`, apiKey, {
    method: 'PUT',
    body: JSON.stringify({ unreadCount: 0 }),
  });
  return { ok: res.ok, status: res.status };
}

async function fetchAllMessages(conversationId: string, apiKey: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const params = new URLSearchParams({ limit: '50' });
    if (cursor) params.set('lastMessageId', cursor);
    const res = await ghlFetch(
      `/conversations/${encodeURIComponent(conversationId)}/messages?${params}`,
      apiKey,
    );
    if (!res.ok) break;
    const data = await res.json().catch(() => null);
    const root = asRecord(data);
    const wrapper = asRecord(root?.messages) ?? root;
    const batch = Array.isArray(wrapper?.messages) ? wrapper!.messages : [];
    for (const item of batch as unknown[]) {
      const rec = asRecord(item);
      if (rec) out.push(rec);
    }
    if (wrapper?.nextPage !== true) break;
    const nextId = wrapper?.lastMessageId != null ? String(wrapper.lastMessageId) : '';
    if (!nextId) break;
    cursor = nextId;
  }
  return out;
}

async function expensiveMarkRead(conversationId: string, apiKey: string): Promise<number> {
  const messages = await fetchAllMessages(conversationId, apiKey);
  let updated = 0;
  for (const msg of messages) {
    const direction = String(msg.direction ?? '');
    const status = String(msg.status ?? '').toLowerCase();
    const id = String(msg.id ?? msg.messageId ?? '');
    if (!id || direction !== 'inbound' || READ_STATUSES.has(status)) continue;
    const res = await ghlFetch(`/conversations/messages/${encodeURIComponent(id)}/status`, apiKey, {
      method: 'PUT',
      body: JSON.stringify({ status: 'read' }),
    });
    if (res.ok) updated++;
  }
  return updated;
}

async function getUnreadCount(conversationId: string, apiKey: string): Promise<number | null> {
  const res = await ghlFetch(`/conversations/${encodeURIComponent(conversationId)}`, apiKey);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const root = asRecord(data);
  const raw = asRecord(root?.conversation) ?? root;
  if (!raw || typeof raw.unreadCount !== 'number') return null;
  return raw.unreadCount;
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

  let body: { organizationId?: string; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const organizationId = body.organizationId?.trim();
  const conversationId = body.conversationId?.trim();
  if (!organizationId || !conversationId) {
    return json({ ok: false, error: 'organizationId and conversationId are required' }, 400);
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

  const { apiKey } = active;

  const cheap = await cheapMarkRead(conversationId, apiKey);
  if (cheap.ok) {
    const unread = await getUnreadCount(conversationId, apiKey);
    if (unread === 0 || unread === null) {
      return json({ ok: true, conversationId, path: 'cheap', messagesUpdated: 0 });
    }
  }

  const messagesUpdated = await expensiveMarkRead(conversationId, apiKey);
  const unreadAfter = await getUnreadCount(conversationId, apiKey);
  if (unreadAfter != null && unreadAfter > 0) {
    return json({ ok: false, error: 'Could not clear unread in GHL' }, 502);
  }

  return json({
    ok: true,
    conversationId,
    path: 'expensive',
    messagesUpdated,
  });
});
