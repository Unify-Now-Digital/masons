interface SendTwilioMessageRequest {
  conversation_id: string;
  body_text: string;
}

interface SendTwilioMessageResponse {
  success: boolean;
  message_id?: string | null;
  twilio_sid?: string | null;
  error?: string;
}

export async function sendTwilioMessage(
  request: SendTwilioMessageRequest,
): Promise<SendTwilioMessageResponse> {
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
  const adminToken = import.meta.env.VITE_INBOX_ADMIN_TOKEN as string | undefined;

  if (!functionsUrl) {
    throw new Error('VITE_SUPABASE_FUNCTIONS_URL is not configured');
  }

  if (!adminToken) {
    throw new Error('VITE_INBOX_ADMIN_TOKEN is not configured');
  }

  const response = await fetch(`${functionsUrl}/inbox-twilio-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify(request),
  });

  const data = (await response.json().catch(() => ({}))) as SendTwilioMessageResponse;

  if (!response.ok || data.success === false) {
    const message = data.error || response.statusText || 'Failed to send message via Twilio';
    throw new Error(message);
  }

  return {
    success: true,
    message_id: data.message_id ?? null,
    twilio_sid: data.twilio_sid ?? null,
  };
}

