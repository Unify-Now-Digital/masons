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

type FetchBody = {
  action?: string;
  organizationId?: string;
  conversationId?: string;
  contactId?: string;
  limit?: number;
  lastMessageId?: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function mapConversation(raw: Record<string, unknown>) {
  const id = String(raw.id ?? raw.conversationId ?? '');
  return {
    id,
    contactId: raw.contactId != null ? String(raw.contactId) : null,
    locationId: raw.locationId != null ? String(raw.locationId) : null,
    unreadCount: typeof raw.unreadCount === 'number' ? raw.unreadCount : Number(raw.unreadCount ?? 0) || 0,
    lastMessageDate: (raw.lastMessageDate ?? raw.dateUpdated ?? raw.updatedAt ?? null) as string | null,
    lastMessageBody: (raw.lastMessageBody ?? raw.lastMessage ?? null) as string | null,
  };
}

function mapMessage(raw: Record<string, unknown>) {
  return {
    id: String(raw.id ?? raw.messageId ?? ''),
    body: (raw.body ?? null) as string | null,
    plainText: (raw.plainText ?? null) as string | null,
    direction: String(raw.direction ?? ''),
    dateAdded: (raw.dateAdded ?? raw.createdAt ?? null) as string | null,
    messageType: (raw.messageType ?? raw.type ?? null) as string | null,
    status: (raw.status ?? null) as string | null,
  };
}

function mapContact(raw: Record<string, unknown>) {
  const first = raw.firstName != null ? String(raw.firstName) : '';
  const last = raw.lastName != null ? String(raw.lastName) : '';
  const name = raw.name != null ? String(raw.name) : [first, last].filter(Boolean).join(' ') || null;
  return {
    id: String(raw.id ?? ''),
    name,
    firstName: first || null,
    lastName: last || null,
    email: (raw.email ?? null) as string | null,
    phone: (raw.phone ?? raw.phoneNumber ?? null) as string | null,
  };
}

async function parseGhlJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function listConversations(
  locationId: string,
  apiKey: string,
  limit = 50,
): Promise<Response> {
  const params = new URLSearchParams({ locationId, limit: String(limit) });
  const res = await ghlFetch(`/conversations/search?${params}`, apiKey);
  const data = await parseGhlJson(res);
  if (!res.ok) {
    return json({ ok: false, error: 'GHL API error', status: res.status }, 502);
  }
  const root = asRecord(data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(root?.conversations)
    ? root!.conversations
    : Array.isArray(root?.data)
    ? root!.data
    : [];
  const conversations = (list as unknown[])
    .map((item) => asRecord(item))
    .filter((r): r is Record<string, unknown> => !!r && !!mapConversation(r).id)
    .map(mapConversation);
  return json({ ok: true, conversations });
}

async function getConversationById(conversationId: string, apiKey: string): Promise<Response> {
  const res = await ghlFetch(`/conversations/${encodeURIComponent(conversationId)}`, apiKey);
  const data = await parseGhlJson(res);
  if (!res.ok) {
    return json({ ok: false, error: 'GHL API error', status: res.status }, 502);
  }
  const root = asRecord(data);
  const raw = asRecord(root?.conversation) ?? root;
  if (!raw) return json({ ok: false, error: 'Invalid GHL response' }, 502);
  return json({ ok: true, conversation: mapConversation(raw) });
}

const MAX_MESSAGE_PAGES = 10;

async function getMessages(
  conversationId: string,
  apiKey: string,
  limit: number,
  aggregateAll: boolean,
  pageCursor: string | null | undefined,
): Promise<Response> {
  const aggregated: ReturnType<typeof mapMessage>[] = [];
  let lastMessageId: string | null = null;
  let nextPage = false;
  let truncated = false;
  let cursor: string | undefined =
    pageCursor && pageCursor.length > 0 ? pageCursor : undefined;

  for (let page = 0; page < MAX_MESSAGE_PAGES; page++) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('lastMessageId', cursor);
    const res = await ghlFetch(
      `/conversations/${encodeURIComponent(conversationId)}/messages?${params}`,
      apiKey,
    );
    const data = await parseGhlJson(res);
    if (!res.ok) {
      return json({ ok: false, error: 'GHL API error', status: res.status }, 502);
    }
    const root = asRecord(data);
    const wrapper = asRecord(root?.messages) ?? root;
    const batch = Array.isArray(wrapper?.messages)
      ? wrapper!.messages
      : Array.isArray(root?.messages)
      ? root!.messages
      : Array.isArray(data)
      ? data
      : [];
    for (const item of batch as unknown[]) {
      const rec = asRecord(item);
      if (rec && mapMessage(rec).id) aggregated.push(mapMessage(rec));
    }
    lastMessageId = wrapper?.lastMessageId != null ? String(wrapper.lastMessageId) : lastMessageId;
    nextPage = wrapper?.nextPage === true;
    if (!nextPage) break;
    if (!aggregateAll) break;
    if (!lastMessageId) break;
    cursor = lastMessageId;
    if (page === MAX_MESSAGE_PAGES - 1 && nextPage) truncated = true;
  }

  return json({
    ok: true,
    messages: aggregated,
    lastMessageId,
    nextPage: truncated ? true : nextPage,
    truncated,
  });
}

async function getContactById(contactId: string, apiKey: string): Promise<Response> {
  const res = await ghlFetch(`/contacts/${encodeURIComponent(contactId)}`, apiKey);
  const data = await parseGhlJson(res);
  if (!res.ok) {
    return json({ ok: false, error: 'GHL API error', status: res.status }, 502);
  }
  const root = asRecord(data);
  const raw = asRecord(root?.contact) ?? root;
  if (!raw) return json({ ok: false, error: 'Invalid GHL response' }, 502);
  return json({ ok: true, contact: mapContact(raw) });
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

  let body: FetchBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const organizationId = body.organizationId?.trim();
  const action = body.action?.trim();
  if (!organizationId || !action) {
    return json({ ok: false, error: 'organizationId and action are required' }, 400);
  }

  const supabase = serviceSupabase();
  const member = await requireOrgMember(supabase, user.id, organizationId);
  if (!member) return json({ ok: false, error: 'Forbidden' }, 403);

  let active;
  try {
    active = await getActiveGhlConnectionWithKey(supabase, organizationId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'GHL configuration error';
    return json({ ok: false, error: msg }, 500);
  }
  if (!active) return json({ ok: false, error: 'No GHL connection' }, 404);

  const { connection, apiKey } = active;
  const locationId = connection.ghl_location_id;

  switch (action) {
    case 'listConversations':
      return listConversations(locationId, apiKey, body.limit ?? 50);
    case 'getConversation': {
      if (!body.conversationId) return json({ ok: false, error: 'conversationId required' }, 400);
      return getConversationById(body.conversationId, apiKey);
    }
    case 'getMessages': {
      if (!body.conversationId) return json({ ok: false, error: 'conversationId required' }, 400);
      return getMessages(
        body.conversationId,
        apiKey,
        body.limit ?? 50,
        !('lastMessageId' in body),
        body.lastMessageId,
      );
    }
    case 'getContact': {
      if (!body.contactId) return json({ ok: false, error: 'contactId required' }, 400);
      return getContactById(body.contactId, apiKey);
    }
    default:
      return json({ ok: false, error: 'Unknown action' }, 400);
  }
});
