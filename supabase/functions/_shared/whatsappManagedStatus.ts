export type ManagedStatus =
  | 'draft'
  | 'collecting_business_info'
  | 'provisioning'
  | 'pending_meta_action'
  | 'pending_provider_review'
  | 'action_required'
  | 'connected'
  | 'degraded'
  | 'failed'
  | 'disconnected';

export interface ManagedReadiness {
  ready: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
}

export interface ManagedConnectionRecord {
  status: ManagedStatus;
  provider_ready: boolean;
  twilio_account_sid: string | null;
  twilio_whatsapp_sender_sid: string | null;
  whatsapp_from_address: string | null;
  last_error: string | null;
}

export function isManagedConnected(record: ManagedConnectionRecord): ManagedReadiness {
  if (record.status !== 'connected') {
    return {
      ready: false,
      reasonCode: 'managed_not_connected',
      reasonMessage: record.last_error ?? 'Managed WhatsApp is not connected yet.',
    };
  }

  if (!record.provider_ready) {
    return {
      ready: false,
      reasonCode: 'provider_not_ready',
      reasonMessage: record.last_error ?? 'Provider is not ready yet.',
    };
  }

  if (!record.twilio_account_sid) {
    return {
      ready: false,
      reasonCode: 'account_sid_missing',
      reasonMessage: record.last_error ?? 'Managed provider account is not linked yet.',
    };
  }

  if (!record.twilio_whatsapp_sender_sid && !record.whatsapp_from_address) {
    return {
      ready: false,
      reasonCode: 'sender_identity_missing',
      reasonMessage: record.last_error ?? 'Managed sender identity is incomplete.',
    };
  }

  return { ready: true, reasonCode: null, reasonMessage: null };
}
