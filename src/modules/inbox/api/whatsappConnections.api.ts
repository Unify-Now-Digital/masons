import { supabase } from '@/shared/lib/supabase';

function extractInvokeErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const maybeMessage = (error as { message?: unknown }).message;
  return typeof maybeMessage === 'string' ? maybeMessage : null;
}

export interface WhatsAppConnection {
  id: string;
  user_id: string;
  provider: string;
  twilio_account_sid: string;
  twilio_api_key_sid: string;
  whatsapp_from: string;
  status: 'connected' | 'disconnected' | 'error';
  last_error: string | null;
  last_validated_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch the current user's WhatsApp connection (connected or latest). RLS returns only own rows.
 */
export async function fetchWhatsAppConnection(): Promise<WhatsAppConnection | null> {
  const { data, error } = await supabase
    .from('whatsapp_connections')
    .select(
      'id, user_id, provider, twilio_account_sid, twilio_api_key_sid, whatsapp_from, status, last_error, last_validated_at, disconnected_at, created_at, updated_at'
    )
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as WhatsAppConnection | null;
}

/**
 * Fetch the latest connected shared WhatsApp connection across workspace users.
 */
export async function fetchConnectedWhatsAppConnection(): Promise<WhatsAppConnection | null> {
  const { data, error } = await supabase
    .from('whatsapp_connections')
    .select(
      'id, user_id, provider, twilio_account_sid, twilio_api_key_sid, whatsapp_from, status, last_error, last_validated_at, disconnected_at, created_at, updated_at'
    )
    .eq('status', 'connected')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as WhatsAppConnection | null;
}

export interface ConnectWhatsAppParams {
  twilio_account_sid: string;
  twilio_api_key_sid: string;
  twilio_api_key_secret: string;
  whatsapp_from: string;
}

/**
 * Connect WhatsApp: validate and store Twilio credentials via Edge Function. Secret is never stored on client.
 */
export async function connectWhatsApp(params: ConnectWhatsAppParams): Promise<{ id: string; status: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to connect WhatsApp');
  }

  const { data, error } = await supabase.functions.invoke<{ ok: boolean; id: string; status: string; error?: string }>(
    'whatsapp-connect',
    {
      body: {
        twilio_account_sid: params.twilio_account_sid.trim(),
        twilio_api_key_sid: params.twilio_api_key_sid.trim(),
        twilio_api_key_secret: params.twilio_api_key_secret,
        whatsapp_from: params.whatsapp_from.trim(),
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    }
  );

  if (error) {
    throw new Error(extractInvokeErrorMessage(error) ?? 'Failed to connect WhatsApp');
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  if (!data?.ok || !data?.id) {
    throw new Error('Invalid response from server');
  }
  return { id: data.id, status: data.status };
}


/**
 * Disconnect WhatsApp: set status to disconnected and disconnected_at. Preserves history.
 */
export async function disconnectWhatsApp(): Promise<void> {
  const { data: conn } = await supabase
    .from('whatsapp_connections')
    .select('id')
    .eq('status', 'connected')
    .maybeSingle();
  if (!conn) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('whatsapp_connections')
    .update({ status: 'disconnected', disconnected_at: now, updated_at: now })
    .eq('id', conn.id);
  if (error) throw error;
}

/**
 * Send a test message via user's WhatsApp connection (Edge Function).
 */
export async function testWhatsAppConnection(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to test WhatsApp');
  }

  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('whatsapp-test', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    throw new Error(extractInvokeErrorMessage(error) ?? 'Test failed');
  }
  if (data?.error) {
    throw new Error(data.error);
  }
}
