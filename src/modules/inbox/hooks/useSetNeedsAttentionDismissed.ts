import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { setNeedsAttentionDismissedAt } from '../api/needsAttention.api';
import type { NeedsAttentionConversation } from '../utils/needsAttention';
import { inboxKeys } from './useInboxConversations';

/** Prefix of every needs-attention query (useNeedsAttentionConversations). */
const NEEDS_ATTENTION_PREFIX = [...inboxKeys.conversations.all, 'needs-attention'] as const;

export interface SetDismissedVariables {
  conversationId: string;
  /** The row's last_message_at to dismiss; the previous marker to undo. */
  value: string | null;
}

/**
 * Writes ai_dismissed_at with an optimistic patch to every cached needs-attention
 * list, rolled back on error. Settles by refetching those lists only; the page's
 * realtime UPDATE listener refreshes the rest of the inbox on its own.
 */
export function useSetNeedsAttentionDismissed() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: ({ conversationId, value }: SetDismissedVariables) => {
      if (!organizationId) throw new Error('No active organization selected');
      return setNeedsAttentionDismissedAt(organizationId, conversationId, value);
    },
    retry: 0,
    onMutate: async ({ conversationId, value }: SetDismissedVariables) => {
      await queryClient.cancelQueries({ queryKey: NEEDS_ATTENTION_PREFIX });
      const previous = queryClient.getQueriesData<NeedsAttentionConversation[]>({
        queryKey: NEEDS_ATTENTION_PREFIX,
      });
      previous.forEach(([key, rows]) => {
        if (!rows) return;
        queryClient.setQueryData<NeedsAttentionConversation[]>(
          key,
          rows.map((row) => (row.id === conversationId ? { ...row, ai_dismissed_at: value } : row)),
        );
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, rows]) =>
        queryClient.setQueryData<NeedsAttentionConversation[]>(key, rows),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NEEDS_ATTENTION_PREFIX });
    },
  });
}
