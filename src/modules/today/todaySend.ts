/**
 * The only send path Today uses. Called from an explicit click or the `e` key,
 * and only when a conversation id exists.
 */
import { sendGmailReply } from '@/modules/inbox/api/inboxGmail.api';
import { sendTwilioMessage } from '@/modules/inbox/api/inboxTwilio.api';

export async function sendPreparedMessage(
  channel: 'email' | 'whatsapp',
  conversationId: string,
  body: string,
  subject?: string,
): Promise<void> {
  if (channel === 'email') {
    await sendGmailReply({ conversationId, bodyText: body, subject });
    return;
  }
  const res = await sendTwilioMessage({ conversation_id: conversationId, body_text: body });
  if (!res.success) throw new Error(res.error || 'Could not send');
}
