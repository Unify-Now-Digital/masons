import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMutedSenders, muteSender, unmuteSender } from '../api/inboxConversations.api';
import { inboxKeys } from './useInboxConversations';

/**
 * Per-org muted-sender list for the grouped inbox. Returns the muted handles as
 * a Set of normalized handles (see conversationGroupKey.normalizeHandle) plus
 * mute/unmute mutations. Handles passed to mute/unmute may be raw — the API
 * normalizes them.
 */
export function useMutedSenders(organizationId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: inboxKeys.mutedSenders(organizationId ?? 'disabled'),
    queryFn: () => listMutedSenders(organizationId!),
    enabled: !!organizationId,
  });

  const mutedHandles = useMemo(
    () => new Set((data ?? []).map((row) => row.normalized_handle)),
    [data]
  );

  const invalidate = () => {
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: inboxKeys.mutedSenders(organizationId) });
    }
  };

  const mute = useMutation({
    mutationFn: (handle: string) => {
      if (!organizationId) throw new Error('No organization selected');
      return muteSender(organizationId, handle);
    },
    onSuccess: invalidate,
  });

  const unmute = useMutation({
    mutationFn: (handle: string) => {
      if (!organizationId) throw new Error('No organization selected');
      return unmuteSender(organizationId, handle);
    },
    onSuccess: invalidate,
  });

  return { mutedHandles, isLoading, isError, mute, unmute };
}
