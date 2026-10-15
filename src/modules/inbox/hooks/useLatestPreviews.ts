import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchLatestMessagePreviews } from '../api/latestPreviews';

export function useLatestPreviews(conversationIds: readonly string[]) {
  const { organizationId } = useOrganization();
  const ids = useMemo(() => [...new Set(conversationIds.filter(Boolean))].sort(), [conversationIds]);
  return useQuery({
    queryKey: ['inbox', 'message-previews', organizationId, ids],
    queryFn: () => fetchLatestMessagePreviews(ids),
    enabled: !!organizationId && ids.length > 0,
    staleTime: 30_000,
  });
}
