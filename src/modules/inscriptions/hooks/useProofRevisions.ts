import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveProofByToken,
  createRevision,
  fetchInscriptionsAwaitingEdits,
  fetchRevisionByToken,
  fetchRevisionsByInscription,
  sendRevision,
  submitProofFeedback,
  updateRevision,
  type CreateRevisionInput,
  type ProofRevision,
  type ProofRevisionUpdate,
} from '../api/proofRevisions.api';
import { supabase } from '@/shared/lib/supabase';
import { inscriptionsKeys } from './useInscriptions';

export const proofRevisionKeys = {
  all: ['proof_revisions'] as const,
  byInscription: (inscriptionId: string) =>
    ['proof_revisions', 'inscription', inscriptionId] as const,
  byToken: (token: string) => ['proof_revisions', 'token', token] as const,
};

export function useRevisionsByInscription(inscriptionId: string | null | undefined) {
  return useQuery({
    queryKey: inscriptionId
      ? proofRevisionKeys.byInscription(inscriptionId)
      : proofRevisionKeys.all,
    queryFn: () => fetchRevisionsByInscription(inscriptionId as string),
    enabled: !!inscriptionId,
  });
}

export function useInscriptionsAwaitingEdits(inscriptionIds: string[]) {
  const key = [...inscriptionIds].sort().join(',');
  return useQuery({
    queryKey: ['proof_revisions', 'awaiting-edits', key],
    queryFn: () => fetchInscriptionsAwaitingEdits(inscriptionIds),
    enabled: inscriptionIds.length > 0,
  });
}

export function useRevisionByToken(token: string | undefined) {
  return useQuery({
    queryKey: token ? proofRevisionKeys.byToken(token) : proofRevisionKeys.all,
    queryFn: () => fetchRevisionByToken(token as string),
    enabled: !!token,
  });
}

export function useCreateRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRevisionInput) => createRevision(input),
    onSuccess: async (rev) => {
      qc.invalidateQueries({ queryKey: proofRevisionKeys.byInscription(rev.inscription_id) });
      // Move the inscription forward to 'proofing' the moment a draft exists,
      // and the order to 'In_Progress' so the workflow status reflects reality.
      await transitionToProofing(rev);
      qc.invalidateQueries({ queryKey: inscriptionsKeys.all });
    },
  });
}

export function useUpdateRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ProofRevisionUpdate }) =>
      updateRevision(id, updates),
    onSuccess: (rev) => {
      qc.invalidateQueries({ queryKey: proofRevisionKeys.byInscription(rev.inscription_id) });
    },
  });
}

export function useSendRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (revisionId: string) => sendRevision(revisionId),
    onSuccess: async (rev) => {
      qc.invalidateQueries({ queryKey: proofRevisionKeys.byInscription(rev.inscription_id) });
      qc.invalidateQueries({ queryKey: ['proof_revisions', 'awaiting-edits'] });
      await transitionToProofing(rev);
      qc.invalidateQueries({ queryKey: inscriptionsKeys.all });
    },
  });
}

export function useSubmitProofFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ token, feedback }: { token: string; feedback: string }) =>
      submitProofFeedback(token, feedback),
    onSuccess: (rev) => {
      if (rev?.public_token) {
        qc.invalidateQueries({ queryKey: proofRevisionKeys.byToken(rev.public_token) });
      }
      qc.invalidateQueries({ queryKey: proofRevisionKeys.byInscription(rev.inscription_id) });
      qc.invalidateQueries({ queryKey: ['proof_revisions', 'awaiting-edits'] });
    },
  });
}

export function useApproveProofByToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ token, name }: { token: string; name: string }) =>
      approveProofByToken(token, name),
    onSuccess: (rev) => {
      if (rev?.public_token) {
        qc.invalidateQueries({ queryKey: proofRevisionKeys.byToken(rev.public_token) });
      }
      qc.invalidateQueries({ queryKey: proofRevisionKeys.byInscription(rev.inscription_id) });
      qc.invalidateQueries({ queryKey: inscriptionsKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Internal status-transition helper
// ---------------------------------------------------------------------------

async function transitionToProofing(rev: ProofRevision): Promise<void> {
  // Inscription → 'proofing' (only if currently pending).
  await supabase
    .from('inscriptions')
    .update({ status: 'proofing' })
    .eq('id', rev.inscription_id)
    .eq('status', 'pending');

  // Order proof_status → 'In_Progress' (only when not already past that point).
  if (rev.order_id) {
    await supabase
      .from('orders')
      .update({ proof_status: 'In_Progress' })
      .eq('id', rev.order_id)
      .in('proof_status', ['NA', 'Not_Received', 'Received']);
  }
}
