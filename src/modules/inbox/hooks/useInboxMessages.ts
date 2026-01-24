import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMessagesByConversation } from '../api/inboxMessages.api';
import { inboxKeys } from './useInboxConversations';
import { sendTwilioMessage } from '../api/inboxTwilio.api';
import { sendGmailReply } from '../api/inboxGmail.api';
import { sendSmsReply } from '../api/inboxSms.api';

export function useMessagesByConversation(conversationId: string | null) {
  return useQuery({
    queryKey: inboxKeys.messages.byConversation(conversationId!),
    queryFn: () => fetchMessagesByConversation(conversationId!),
    enabled: !!conversationId,
  });
}

export function useSendReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      bodyText, 
      channel 
    }: { 
      conversationId: string; 
      bodyText: string;
      channel: 'email' | 'sms' | 'whatsapp';
    }) => {
      // Validate body text (trim, reject empty)
      const trimmedBodyText = bodyText.trim();
      if (!trimmedBodyText) {
        throw new Error('Message body cannot be empty');
      }

      // Route to appropriate service based on channel
      if (channel === 'email') {
        return await sendGmailReply({
          conversationId,
          bodyText: trimmedBodyText,
        });
      }
      if (channel === 'sms') {
        return await sendSmsReply({
          conversationId,
          bodyText: trimmedBodyText,
        });
      }
      // WhatsApp via inbox-twilio-send
      return await sendTwilioMessage({
        conversation_id: conversationId,
        body_text: trimmedBodyText,
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate message thread
      queryClient.invalidateQueries({ queryKey: inboxKeys.messages.byConversation(variables.conversationId) });
      // Invalidate conversation list (to update last_message_*)
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
      // Invalidate conversation detail
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.detail(variables.conversationId) });
    },
  });
}
