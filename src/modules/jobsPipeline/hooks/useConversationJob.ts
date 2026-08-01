import { useQuery } from '@tanstack/react-query';
import { fetchConversationJob } from '../api/jobsPipeline.api';
import { jobsPipelineKeys } from '../api/jobsPipelineKeys';

/** Probe for an existing job on a conversation (RLS-scoped). Null result = no job yet. */
export function useConversationJob(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: jobsPipelineKeys.conversationJob(conversationId ?? ''),
    queryFn: () => fetchConversationJob(conversationId!),
    enabled: !!conversationId,
  });
}
