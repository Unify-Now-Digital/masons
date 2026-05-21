import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { markGhlConversationRead, type GhlConversationSummary } from '../api/ghlInbox.api';
import { ghlInboxKeys } from '../api/ghlInbox.keys';

export function useGhlMarkRead() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (conversationId: string) =>
      markGhlConversationRead(organizationId!, conversationId),
    onSuccess: (_data, conversationId) => {
      if (!organizationId) return;

      const conversationsKey = ghlInboxKeys.conversations(organizationId);
      queryClient.setQueriesData<GhlConversationSummary[]>(
        { queryKey: conversationsKey },
        (old) => {
          if (!old) return old;
          return old.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c,
          );
        },
      );

      queryClient.invalidateQueries({ queryKey: conversationsKey });
      queryClient.invalidateQueries({
        queryKey: ghlInboxKeys.messages(organizationId, conversationId),
      });
    },
  });
}
