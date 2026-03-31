import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProofByOrder,
  fetchProofsByOrders,
  approveProof,
  requestProofChanges,
  generateProof,
  sendProof,
} from '../api/proofs.api';
import type {
  OrderProof,
  ProofGenerateRequest,
  ProofSendRequest,
} from '../types/proofs.types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const proofKeys = {
  all: ['order_proofs'] as const,
  byOrder: (orderId: string) => ['order_proofs', 'order', orderId] as const,
  byOrders: (orderIds: string[]) => ['order_proofs', 'batch', ...orderIds] as const,
  detail: (proofId: string) => ['order_proofs', proofId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch the latest proof for an order.
 * Disabled when orderId is null/undefined.
 */
export function useProofByOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: proofKeys.byOrder(orderId ?? ''),
    queryFn: () => fetchProofByOrder(orderId!),
    enabled: !!orderId,
  });
}

/**
 * Batch-fetch the latest proof for multiple orders in a single query.
 * Returns a map keyed by order_id for O(1) lookup in list renders.
 * This replaces per-row useProofByOrder calls and eliminates the N+1 query issue.
 *
 * Only enabled when orderIds is non-empty.
 */
export function useProofsByOrders(orderIds: string[]): {
  data: Record<string, OrderProof | undefined>;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: proofKeys.byOrders(orderIds),
    queryFn: () => fetchProofsByOrders(orderIds),
    enabled: orderIds.length > 0,
    staleTime: 30_000, // 30 s — list views tolerate slightly stale proof status
  });

  // Deduplicate: per order_id keep only the first (latest) proof row,
  // because fetchProofsByOrders returns rows ordered by created_at DESC.
  const map: Record<string, OrderProof | undefined> = {};
  for (const proof of query.data ?? []) {
    if (!(proof.order_id in map)) {
      map[proof.order_id] = proof;
    }
  }

  return { data: map, isLoading: query.isLoading };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Trigger AI proof generation. Invalidates the order's proof cache on success. */
export function useGenerateProof() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ProofGenerateRequest) => generateProof(params),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({
        queryKey: proofKeys.byOrder(params.order_id),
      });
    },
  });
}

/** Send the proof to the customer. Invalidates cache for the order. */
export function useSendProof() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ProofSendRequest) => sendProof(params),
    onSuccess: (data) => {
      // Invalidate by order — we don't store order_id in the response,
      // so we do a broader invalidation of all proof queries.
      // The calling component can pass orderId to narrow this if needed.
      queryClient.invalidateQueries({ queryKey: proofKeys.all });
    },
  });
}

/** Staff manually approves a sent proof. */
export function useApproveProof() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proofId: string) => approveProof(proofId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: proofKeys.byOrder(data.order_id),
      });
    },
  });
}

/** Record a customer change request on a sent proof. */
export function useRequestProofChanges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ proofId, changesNote }: { proofId: string; changesNote: string }) =>
      requestProofChanges(proofId, changesNote),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: proofKeys.byOrder(data.order_id),
      });
    },
  });
}
