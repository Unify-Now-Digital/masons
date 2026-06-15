import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateConversation } from '../api/inboxConversations.api';
import type { InboxConversation } from '../types/inbox.types';
import { enquiryPipelineKeys } from './useEnquiryPipeline';
import { inboxKeys } from './useInboxConversations';
import { invalidateInboxThreadSummaries } from './useThreadSummary';

type EnquiryStageUpdate = Extract<
  NonNullable<InboxConversation['enquiry_stage']>,
  'new' | 'in_progress'
>;

export function useUpdateEnquiryStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      enquiry_stage,
    }: {
      conversationId: string;
      enquiry_stage: EnquiryStageUpdate;
    }) => updateConversation(conversationId, { enquiry_stage }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: enquiryPipelineKeys.all });
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      queryClient.invalidateQueries({
        queryKey: inboxKeys.conversations.detail(variables.conversationId),
      });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}
