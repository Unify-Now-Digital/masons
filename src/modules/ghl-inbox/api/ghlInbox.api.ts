import { supabase } from '@/shared/lib/supabase';

export type GhlConnectionStatus = 'active' | 'disconnected' | 'error';

export type GhlConnectionRow = {
  id: string;
  organization_id: string;
  ghl_location_id: string;
  status: GhlConnectionStatus;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GhlConversationSummary = {
  id: string;
  contactId: string | null;
  locationId: string | null;
  unreadCount: number;
  lastMessageDate: string | null;
  lastMessageBody: string | null;
};

export type GhlMessageItem = {
  id: string;
  body: string | null;
  plainText: string | null;
  direction: string;
  dateAdded: string | null;
  messageType: string | null;
  status: string | null;
};

export type GhlContactSummary = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

type FetchAction =
  | { action: 'listConversations'; organizationId: string; limit?: number }
  | { action: 'getConversation'; organizationId: string; conversationId: string }
  | {
      action: 'getMessages';
      organizationId: string;
      conversationId: string;
      limit?: number;
    }
  | { action: 'getContact'; organizationId: string; contactId: string };

async function invokeGhlFetch<T>(body: FetchAction): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { ok?: boolean; error?: string }>(
    'ghl-fetch',
    { body },
  );
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload || payload.ok === false) {
    throw new Error(payload?.error ?? 'GHL fetch failed');
  }
  return data as T;
}

export async function fetchGhlConversations(
  organizationId: string,
): Promise<GhlConversationSummary[]> {
  const data = await invokeGhlFetch<{ conversations: GhlConversationSummary[] }>({
    action: 'listConversations',
    organizationId,
    limit: 50,
  });
  return data.conversations ?? [];
}

export async function fetchGhlMessages(
  organizationId: string,
  conversationId: string,
): Promise<GhlMessageItem[]> {
  const data = await invokeGhlFetch<{ messages: GhlMessageItem[] }>({
    action: 'getMessages',
    organizationId,
    conversationId,
    limit: 50,
  });
  return data.messages ?? [];
}

export async function fetchGhlContact(
  organizationId: string,
  contactId: string,
): Promise<GhlContactSummary> {
  const data = await invokeGhlFetch<{ contact: GhlContactSummary }>({
    action: 'getContact',
    organizationId,
    contactId,
  });
  return data.contact;
}

export async function markGhlConversationRead(
  organizationId: string,
  conversationId: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    error?: string;
  }>('ghl-mark-read', {
    body: { organizationId, conversationId },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? 'Mark as read failed');
}

export async function fetchGhlConnection(
  organizationId: string,
): Promise<GhlConnectionRow | null> {
  const { data, error } = await supabase
    .from('ghl_connections')
    .select('id, organization_id, ghl_location_id, status, last_verified_at, created_at, updated_at')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as GhlConnectionRow | null;
}

export async function disconnectGhlConnection(connectionId: string): Promise<void> {
  const { error } = await supabase
    .from('ghl_connections')
    .update({ status: 'disconnected' })
    .eq('id', connectionId);
  if (error) throw new Error(error.message);
}
