import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMessagesByConversation } from '../api/inboxMessages.api';
import { inboxKeys } from './useInboxConversations';
import { sendTwilioMessage } from '../api/inboxTwilio.api';

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
    mutationFn: async ({ conversationId, bodyText }: { conversationId: string; bodyText: string }) => {
      // Validate body text (trim, reject empty)
      const trimmedBodyText = bodyText.trim();
      if (!trimmedBodyText) {
        throw new Error('Message body cannot be empty');
      }

      // Call Edge Function to send via Twilio and update DB
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
