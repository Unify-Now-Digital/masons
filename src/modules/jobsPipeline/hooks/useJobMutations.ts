import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useToast } from '@/shared/hooks/use-toast';
import {
  exitJob,
  InvoicedGateError,
  moveJobStage,
} from '../api/jobsPipeline.api';
import { jobsPipelineKeys } from '../api/jobsPipelineKeys';
import type { BeforePaidStage, PrePaidExitReason } from '../types/jobsPipeline.types';

export function useMoveJobStage() {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (args: { jobId: string; fromStage: BeforePaidStage; toStage: BeforePaidStage }) => {
      if (!organizationId) throw new Error('No organization selected');
      return moveJobStage({ organizationId, ...args });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.active(organizationId) });
    },
    onError: (error: unknown) => {
      if (error instanceof InvoicedGateError) {
        toast({ title: 'No invoice linked to this job yet', variant: 'destructive' });
        // The gate state was stale — refresh the summaries driving the button.
        queryClient.invalidateQueries({
          queryKey: jobsPipelineKeys.invoiceSummaries(organizationId),
        });
        return;
      }
      toast({
        title: 'Failed to move job',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    },
  });
}

export function useExitJob() {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (args: { jobId: string; reason: PrePaidExitReason; wakeAt?: string | null }) => {
      if (!organizationId) throw new Error('No organization selected');
      return exitJob({ organizationId, ...args });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.active(organizationId) });
      queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.exited(organizationId) });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to exit job',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    },
  });
}
