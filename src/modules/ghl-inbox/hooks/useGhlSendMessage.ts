import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  GhlSendMessageError,
  sendGhlMessage,
  type GhlMessageItem,
} from '../api/ghlInbox.api';
import { ghlInboxKeys } from '../api/ghlInbox.keys';
import type { GhlSendChannelType } from '../lib/channelType';

export type SendMessageVariables = {
  contactId: string;
  conversationId: string;
  type: GhlSendChannelType;
  message: string;
  requestId: string;
};

export function useGhlSendMessage() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (vars: SendMessageVariables) => {
      if (!organizationId) throw new Error('No organisation selected');
      return sendGhlMessage({
        organizationId,
        contactId: vars.contactId,
        conversationId: vars.conversationId,
        type: vars.type,
        message: vars.message,
        requestId: vars.requestId,
      });
    },
    onMutate: async (vars) => {
      if (!organizationId) return;

      const messagesKey = ghlInboxKeys.messages(organizationId, vars.conversationId);
      await queryClient.cancelQueries({ queryKey: messagesKey });

      const previous = queryClient.getQueryData<GhlMessageItem[]>(messagesKey);
      const optimistic: GhlMessageItem = {
        id: `optimistic-${vars.requestId}`,
        body: vars.message,
        plainText: vars.message,
        direction: 'outbound',
        dateAdded: new Date().toISOString(),
        messageType: vars.type,
        status: 'pending',
      };

      queryClient.setQueryData<GhlMessageItem[]>(messagesKey, (old) =>
        old ? [...old, optimistic] : [optimistic],
      );

      return { previous, messagesKey };
    },
    onSuccess: (_data, vars) => {
      if (!organizationId) return;
      queryClient.invalidateQueries({
        queryKey: ghlInboxKeys.messages(organizationId, vars.conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: ghlInboxKeys.conversations(organizationId),
      });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined && context.messagesKey) {
        queryClient.setQueryData(context.messagesKey, context.previous);
      }
    },
    onSettled: (_data, _err, vars) => {
      if (!organizationId) return;
      queryClient.invalidateQueries({
        queryKey: ghlInboxKeys.messages(organizationId, vars.conversationId),
      });
    },
  });
}

export function formatSendError(err: unknown): { title: string; description: string } {
  if (err instanceof GhlSendMessageError) {
    const description = err.ghlMessage ?? err.message;
    if (err.statusCode === 409) {
      return {
        title: 'Send in progress',
        description,
      };
    }
    return {
      title: 'Could not send message',
      description,
    };
  }
  if (err instanceof Error) {
    return { title: 'Could not send message', description: err.message };
  }
  return { title: 'Could not send message', description: 'Please try again.' };
}
