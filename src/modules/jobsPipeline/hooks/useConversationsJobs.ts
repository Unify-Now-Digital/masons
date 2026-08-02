import { useQuery } from '@tanstack/react-query';
import { fetchConversationsJobs } from '../api/jobsPipeline.api';
import { jobsPipelineKeys } from '../api/jobsPipelineKeys';

/** All jobs across a customer group's conversations (newest first). RLS-scoped. */
export function useConversationsJobs(conversationIds: string[] | undefined) {
  const ids = conversationIds ?? [];
  return useQuery({
    queryKey: jobsPipelineKeys.conversationJobs(ids),
    queryFn: () => fetchConversationsJobs(ids),
    enabled: ids.length > 0,
  });
}
