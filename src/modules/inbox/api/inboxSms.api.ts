interface SendSmsReplyResponse {
  success: boolean;
  message_id?: string | null;
  twilio_sid?: string | null;
  error?: string;
}

/**
 * Send an SMS reply for an SMS conversation via inbox-sms-send Edge Function.
 */
export async function sendSmsReply({
  conversationId,
  bodyText,
}: {
  conversationId: string;
  bodyText: string;
}): Promise<{ success: true; message_id: string | null; twilio_sid: string | null }> {
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
  const adminToken = import.meta.env.VITE_INBOX_ADMIN_TOKEN as string | undefined;

  if (!functionsUrl?.trim()) {
    throw new Error('VITE_SUPABASE_FUNCTIONS_URL is not configured');
  }

  if (!adminToken?.trim()) {
    throw new Error('VITE_INBOX_ADMIN_TOKEN is not configured');
  }

  const base = functionsUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/inbox-sms-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken.trim(),
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      body_text: bodyText,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as SendSmsReplyResponse;

  if (!response.ok || data.success === false) {
    const message = data.error ?? response.statusText ?? 'Failed to send SMS';
    throw new Error(message);
  }

  return {
    success: true,
    message_id: data.message_id ?? null,
    twilio_sid: data.twilio_sid ?? null,
  };
}
