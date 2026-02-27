import { supabase } from '@/shared/lib/supabase';

interface SyncGmailOptions {
  since?: string;
}

interface SyncGmailResult {
  ok: boolean;
  synced: number;
}

interface SendGmailReplyResult {
  ok: boolean;
  message_id: string;
}

interface SendGmailNewThreadResult {
  success: true;
  gmailMessageId: string;
  gmailThreadId: string;
  conversationId: string;
}

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to sync or send Gmail');
  }
  return session.access_token;
}

/**
 * Sync Gmail for the current user (from now onward). Uses gmail-sync-now Edge Function with JWT.
 */
export async function syncGmail(options?: SyncGmailOptions): Promise<{ syncedCount: number }> {
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (!functionsUrl) {
    throw new Error('VITE_SUPABASE_FUNCTIONS_URL is not set');
  }
  const token = await getAccessToken();
  const response = await fetch(`${functionsUrl}/gmail-sync-now`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(options?.since ? { since: options.since } : {}),
  });
  if (response.status === 404) {
    const err = await response.json().catch(() => ({ error: 'No Gmail connection' }));
    throw new Error(err.error ?? 'No Gmail connection');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error ?? `Gmail sync failed: ${response.statusText}`);
  }
  const data = (await response.json()) as SyncGmailResult;
  return { syncedCount: data.synced ?? 0 };
}

/**
 * Send a Gmail reply for an email conversation. Uses gmail-send-reply Edge Function with JWT.
 */
export async function sendGmailReply({
  conversationId,
  bodyText,
  subject,
}: {
  conversationId: string;
  bodyText: string;
  subject?: string;
}): Promise<SendGmailReplyResult> {
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (!functionsUrl) {
    throw new Error('VITE_SUPABASE_FUNCTIONS_URL is not set');
  }
  const token = await getAccessToken();
  const response = await fetch(`${functionsUrl}/gmail-send-reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      message_body: bodyText,
      ...(subject != null && subject !== '' ? { subject } : {}),
    }),
  });
  if (response.status === 404) {
    const err = await response.json().catch(() => ({ error: 'No Gmail connection' }));
    throw new Error(err.error ?? 'No Gmail connection');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error ?? `Gmail send failed: ${response.statusText}`);
  }
  return (await response.json()) as SendGmailReplyResult;
}

/**
 * Send a new outbound Gmail email (new thread). Uses legacy inbox-gmail-new-thread if present;
 * otherwise throws. Not part of per-user Gmail spec; kept for compatibility.
 */
export async function sendGmailNewEmail({
  to,
  subject,
  bodyText,
}: {
  to: string;
  subject: string;
  bodyText: string;
}): Promise<SendGmailNewThreadResult> {
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const adminToken = import.meta.env.VITE_INBOX_ADMIN_TOKEN;
  if (!functionsUrl || !adminToken) {
    throw new Error(
      'Gmail new thread requires VITE_SUPABASE_FUNCTIONS_URL and VITE_INBOX_ADMIN_TOKEN'
    );
  }
  const response = await fetch(`${functionsUrl}/inbox-gmail-new-thread`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ to, subject, body_text: bodyText }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error ?? `Gmail send failed: ${response.statusText}`);
  }
  return (await response.json()) as SendGmailNewThreadResult;
}
