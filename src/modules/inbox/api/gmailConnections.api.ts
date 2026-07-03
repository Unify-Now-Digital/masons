import { supabase } from '@/shared/lib/supabase';

export interface GmailConnection {
  id: string;
  user_id: string;
  organization_id: string;
  provider: string;
  email_address: string | null;
  status: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface GmailDisconnectResponse {
  success: boolean;
  /** Present when there was no active connection — the desired end-state already held. */
  noActiveConnection?: boolean;
}

/**
 * Extract status + `{ error }` body from a failed functions.invoke call. supabase-js puts the raw
 * Response on `error.context` and leaves `error.message` generic ("Edge Function returned a
 * non-2xx status code"), so the server's message must be read from the body.
 */
async function readFunctionError(
  error: unknown,
): Promise<{ status?: number; serverMessage?: string }> {
  if (!error || typeof error !== 'object' || !('context' in error)) return {};
  const ctx = (error as { context?: unknown }).context;
  if (!ctx || typeof ctx !== 'object') return {};
  const status =
    typeof (ctx as { status?: unknown }).status === 'number'
      ? (ctx as { status: number }).status
      : undefined;
  let serverMessage: string | undefined;
  if (typeof (ctx as Response).json === 'function') {
    try {
      const body = (await (ctx as Response).json()) as { error?: unknown };
      if (typeof body?.error === 'string') serverMessage = body.error;
    } catch {
      /* non-JSON body — fall through to the caller's generic message */
    }
  }
  return { status, serverMessage };
}

/**
 * Fetch the org's Gmail connection (shared mailbox — at most one active row per org).
 * Org-scoped to match the org-based RLS policy; which member connected it doesn't matter for reads.
 * Falls back to the most recent `revoked` row when no active one exists, so the settings surface
 * can render the "reconnect required" indicator (FR-017). Callers that need a usable mailbox must
 * check `status === 'active'`, not just non-null.
 */
export async function fetchOrgGmailConnection(
  organizationId: string,
): Promise<GmailConnection | null> {
  const { data, error } = await supabase
    .from('gmail_connections')
    .select(
      'id, user_id, organization_id, provider, email_address, status, last_synced_at, created_at, updated_at',
    )
    .eq('organization_id', organizationId)
    .in('status', ['active', 'revoked'])
    // 'active' sorts before 'revoked', so the (unique) active row wins whenever present;
    // otherwise the newest revoked row drives the reconnect indicator.
    .order('status', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as GmailConnection | null;
}

/**
 * Start "Connect Gmail" flow: get OAuth URL from Edge Function (JWT + admin-gated), then redirect.
 * Uses the shared supabase client and explicitly passes the session JWT so the Edge Function receives a valid user token.
 */
export async function getGmailOAuthUrl(organizationId: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to connect Gmail');
  }

  const { data, error } = await supabase.functions.invoke<{ url: string }>('gmail-oauth-start', {
    body: { organizationId },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const { status, serverMessage } = await readFunctionError(error);
    if (status === 401) {
      throw new Error('You must be signed in to connect Gmail');
    }
    if (status === 403) {
      throw new Error(serverMessage ?? 'Admin access required to connect Gmail');
    }
    throw new Error(serverMessage ?? 'Could not start Gmail connect — please try again');
  }

  if (!data?.url) {
    throw new Error('No OAuth URL returned');
  }

  return data.url;
}

/**
 * Disconnect the org's Gmail mailbox via the gmail-disconnect Edge Function (server-side admin
 * gate + best-effort Google token revocation). `noActiveConnection: true` counts as success —
 * the desired end-state (no active connection) already holds.
 */
export async function disconnectGmail(organizationId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to disconnect Gmail');
  }

  const { data, error } = await supabase.functions.invoke<GmailDisconnectResponse>(
    'gmail-disconnect',
    {
      body: { organizationId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  if (error) {
    const { status, serverMessage } = await readFunctionError(error);
    if (status === 401) {
      throw new Error('You must be signed in to disconnect Gmail');
    }
    if (status === 403) {
      throw new Error(serverMessage ?? 'Admin access required to disconnect Gmail');
    }
    throw new Error(serverMessage ?? 'Failed to disconnect Gmail — please try again');
  }

  if (!data?.success) {
    throw new Error('Failed to disconnect Gmail — please try again');
  }
}
