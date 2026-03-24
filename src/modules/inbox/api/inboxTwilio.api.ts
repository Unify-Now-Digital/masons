import { supabase } from '@/shared/lib/supabase';

interface SendTwilioMessageRequest {
  conversation_id: string;
  body_text: string;
}

interface SendTwilioMessageResponse {
  success: boolean;
  message_id?: string | null;
  twilio_sid?: string | null;
  error?: string;
  status?: string;
  status_reason_code?: string | null;
  status_reason_message?: string | null;
  action_required?: boolean;
}

/**
 * Send a message via WhatsApp/SMS using the current user's Twilio connection.
 * Uses Supabase JWT so the Edge Function can identify the user and use their stored credentials.
 */
export async function sendTwilioMessage(
  request: SendTwilioMessageRequest,
): Promise<SendTwilioMessageResponse> {
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
  if (!functionsUrl) {
    throw new Error('VITE_SUPABASE_FUNCTIONS_URL is not configured');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to send messages');
  }

  const response = await fetch(`${functionsUrl}/inbox-twilio-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(request),
  });

  const data = (await response.json().catch(() => ({}))) as SendTwilioMessageResponse;

  if (!response.ok || data.success === false) {
    const details = [
      data.status_reason_message,
      data.status,
      data.status_reason_code,
    ]
      .filter(Boolean)
      .join(' / ');
    const message = [data.error || response.statusText || 'Failed to send message via Twilio', details]
      .filter(Boolean)
      .join(': ');
    throw new Error(message);
  }

  return {
    success: true,
    message_id: data.message_id ?? null,
    twilio_sid: data.twilio_sid ?? null,
  };
}
