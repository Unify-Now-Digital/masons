import { supabase } from '@/shared/lib/supabase';

export interface GmailConnection {
  id: string;
  user_id: string;
  provider: string;
  email_address: string | null;
  status: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch the current user's active Gmail connection.
 * Scoped by session user_id so it stays correct under org-based RLS (multiple active rows per org).
 */
export async function fetchActiveGmailConnection(): Promise<GmailConnection | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('gmail_connections')
    .select('id, user_id, provider, email_address, status, last_synced_at, created_at, updated_at')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data as GmailConnection | null;
}

/**
 * Start "Connect Gmail" flow: get OAuth URL from Edge Function (JWT required), then redirect.
 * Uses the shared supabase client and explicitly passes the session JWT so the Edge Function receives a valid user token.
 */
export async function getGmailOAuthUrl(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to connect Gmail');
  }

  const { data, error } = await supabase.functions.invoke<{ url: string }>('gmail-oauth-start', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const message =
      (error as any)?.message === 'Unauthorized'
        ? 'You must be signed in to connect Gmail'
        : (error as any)?.message || 'Failed to get Gmail connect URL';
    throw new Error(message);
  }

  if (!data?.url) {
    throw new Error('No OAuth URL returned');
  }

  return data.url;
}

/**
 * Disconnect Gmail: set active connection to revoked (RLS allows update for own row).
 */
export async function disconnectGmail(): Promise<void> {
  const { data: conn } = await supabase
    .from('gmail_connections')
    .select('id')
    .eq('status', 'active')
    .maybeSingle();
  if (!conn) return;
  const { error } = await supabase
    .from('gmail_connections')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', conn.id);
  if (error) throw error;
}
