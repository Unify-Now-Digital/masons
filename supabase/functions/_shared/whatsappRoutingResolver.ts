import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { isManagedConnected } from './whatsappManagedStatus.ts';

type PreferredMode = 'managed' | 'manual';

type ManualConnection = {
  id: string;
  status: 'connected' | 'disconnected' | 'error';
  twilio_account_sid: string;
  twilio_api_key_sid: string;
  twilio_api_key_secret_encrypted: string;
  whatsapp_from: string;
};

type ManagedConnection = {
  id: string;
  status: string;
  provider_ready: boolean;
  twilio_account_sid: string | null;
  twilio_whatsapp_sender_sid: string | null;
  whatsapp_from_address: string | null;
  last_error: string | null;
};

export type ResolvedRouting =
  | {
      ok: true;
      mode: 'manual';
      manualConnection: ManualConnection;
    }
  | {
      ok: true;
      mode: 'managed';
      managedConnection: ManagedConnection;
    }
  | {
      ok: false;
      mode: PreferredMode;
      error: string;
      status?: string;
      status_reason_code?: string | null;
      status_reason_message?: string | null;
      action_required?: boolean;
    };

export async function resolveWhatsAppRouting(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResolvedRouting> {
  const { data: pref, error: prefError } = await supabase
    .from('whatsapp_user_preferences')
    .select('preferred_whatsapp_mode')
    .eq('user_id', userId)
    .maybeSingle();

  if (prefError) {
    console.error('resolveWhatsAppRouting: failed reading preference, defaulting to manual', {
      userId,
      message: prefError.message,
      code: prefError.code,
    });
  }

  const preferredMode = (pref?.preferred_whatsapp_mode ?? 'manual') as PreferredMode;

  if (preferredMode === 'managed') {
    const { data: managedRow, error } = await supabase
      .from('whatsapp_managed_connections')
      .select(
        'id, state, provider_ready, platform_twilio_account_sid, twilio_sender, display_number, last_error',
      )
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !managedRow) {
      return {
        ok: false,
        mode: 'managed',
        error: 'managed_whatsapp_not_configured',
        status_reason_code: 'managed_missing',
        status_reason_message: 'Start managed WhatsApp onboarding first.',
        action_required: true,
      };
    }

    const managed: ManagedConnection = {
      id: managedRow.id,
      status: managedRow.state,
      provider_ready: managedRow.provider_ready,
      twilio_account_sid: managedRow.platform_twilio_account_sid,
      twilio_whatsapp_sender_sid: managedRow.twilio_sender,
      whatsapp_from_address: managedRow.display_number,
      last_error: managedRow.last_error,
    };

    const readiness = isManagedConnected(managed);
    if (!readiness.ready) {
      return {
        ok: false,
        mode: 'managed',
        error: 'managed_whatsapp_not_ready',
        status: managed.status,
        status_reason_code: readiness.reasonCode,
        status_reason_message: readiness.reasonMessage,
        action_required:
          managed.status === 'action_required' || managed.status === 'failed' || managed.status === 'pending_meta_action',
      };
    }

    return { ok: true, mode: 'managed', managedConnection: managed };
  }

  const { data: manual, error: manualError } = await supabase
    .from('whatsapp_connections')
    .select('id, status, twilio_account_sid, twilio_api_key_sid, twilio_api_key_secret_encrypted, whatsapp_from')
    .eq('status', 'connected')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (manualError || !manual) {
    return {
      ok: false,
      mode: 'manual',
      error: 'manual_whatsapp_not_connected',
      status_reason_code: 'manual_missing',
      status_reason_message: 'Connect manual WhatsApp credentials in Profile.',
      action_required: true,
    };
  }

  return { ok: true, mode: 'manual', manualConnection: manual };
}
