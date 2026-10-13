import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchNeedsAttentionConversations } from '../api/needsAttention.api';
import type { NeedsAttentionConversation } from '../utils/needsAttention';
import { inboxKeys } from './useInboxConversations';
import { useOwnHandles } from './useOwnHandles';

/**
 * Keyed under inboxKeys.conversations.all, so the sweep's prefix invalidation
 * (useInboxAiSweep) and every conversations-wide invalidation refetch it. The
 * own-handle list is in the key: a newly connected mailbox refetches.
 * Waits for the own-handle read so the first fetch is already filtered; a
 * failed read settles as not-loading and the static own domains still apply.
 */
export function useNeedsAttentionConversations(): {
  data: NeedsAttentionConversation[] | undefined;
  isLoading: boolean;
} {
  const { organizationId } = useOrganization();
  const { ownHandles, isLoading: ownHandlesLoading } = useOwnHandles();
  const ownKey = useMemo(() => [...ownHandles.handles].sort(), [ownHandles]);
  const { data, isLoading } = useQuery({
    queryKey: [...inboxKeys.conversations.all, 'needs-attention', organizationId, ownKey],
    queryFn: () => fetchNeedsAttentionConversations(organizationId!, ownHandles),
    enabled: !!organizationId && !ownHandlesLoading,
  });
  // A disabled query is not isLoading on TanStack v5, so the wait counts here.
  return { data, isLoading: ownHandlesLoading || isLoading };
}
