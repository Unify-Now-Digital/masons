import { createElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useToast } from '@/shared/hooks/use-toast';
import { ToastAction, type ToastActionElement } from '@/shared/components/ui/toast';
import {
  addConversationToPipeline,
  AlreadyInPipelineError,
  ConversationLinkError,
} from '../api/addToPipeline.api';
import {
  exitJob,
  InvoicedGateError,
  moveJobStage,
  reopenJob,
} from '../api/jobsPipeline.api';
import { jobsPipelineKeys } from '../api/jobsPipelineKeys';
import type { JobStage, PrePaidExitReason } from '../types/jobsPipeline.types';

/** Root key of the inbox module's query cache (not exported from its barrel). */
const INBOX_ROOT_KEY = ['inbox'] as const;

export function useMoveJobStage() {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    // Stage typing is wide (both axes); moveJobStage's axis check is the guard —
    // callers must derive to/from within their own board's stage list.
    mutationFn: (args: { jobId: string; fromStage: JobStage; toStage: JobStage }) => {
      if (!organizationId) throw new Error('No organization selected');
      return moveJobStage({ organizationId, ...args });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.active(organizationId) });
      queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.afterPaid(organizationId) });
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

export function useAddToPipeline() {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Root-level invalidation: covers the active board, both conversation-job
  // probes (single + group), and the inbox caches in one sweep.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.all });
    queryClient.invalidateQueries({ queryKey: INBOX_ROOT_KEY });
  };

  return useMutation({
    mutationFn: (args: { conversationId: string; allowAdditional?: boolean }) => {
      if (!organizationId) throw new Error('No organization selected');
      return addConversationToPipeline({ organizationId, ...args });
    },
    onSuccess: (_result, args) => {
      invalidate();
      toast({
        title: args.allowAdditional ? 'New job created' : 'Added to pipeline',
        description: 'Job created at Enquired.',
        action: createElement(
          ToastAction,
          { altText: 'View pipeline', onClick: () => navigate('/dashboard/inquiries') },
          'View pipeline',
        ) as unknown as ToastActionElement,
      });
    },
    onError: (error: unknown) => {
      if (error instanceof AlreadyInPipelineError) {
        invalidate();
        toast({ title: 'Already in pipeline' });
        return;
      }
      if (error instanceof ConversationLinkError) {
        // Partial progress: the job exists; only the conversation link failed.
        invalidate();
        toast({
          title: 'Job created, but conversation not linked',
          description: 'Use "Link person" on the conversation to finish linking.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Failed to add to pipeline',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    },
  });
}

export function useReopenJob() {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (args: { jobId: string }) => {
      if (!organizationId) throw new Error('No organization selected');
      return reopenJob({ organizationId, ...args });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.active(organizationId) });
      queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.exited(organizationId) });
      queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.dueDormantCount(organizationId) });
      toast({ title: 'Job reopened', description: 'Back on the board at its previous stage.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Failed to reopen job',
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
      queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.dueDormantCount(organizationId) });
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
