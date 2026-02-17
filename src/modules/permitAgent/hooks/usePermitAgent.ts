import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPermitPipeline,
  getOrderPermit,
  createOrderPermit,
  updateOrderPermit,
  deleteOrderPermit,
  listActivities,
  createActivity,
  initializePermitsForOrders,
} from '../api/permitAgent.api';
import type {
  OrderPermitInsert,
  OrderPermitUpdate,
  PermitActivityLogInsert,
} from '../types/permitAgent.types';

export const permitAgentKeys = {
  all: ['permitAgent'] as const,
  pipeline: () => ['permitAgent', 'pipeline'] as const,
  detail: (id: string) => ['permitAgent', 'detail', id] as const,
  activities: (permitId: string) => ['permitAgent', 'activities', permitId] as const,
};

export function usePermitPipeline() {
  return useQuery({
    queryKey: permitAgentKeys.pipeline(),
    queryFn: fetchPermitPipeline,
  });
}

export function useOrderPermit(id: string) {
  return useQuery({
    queryKey: permitAgentKeys.detail(id),
    queryFn: () => getOrderPermit(id),
    enabled: !!id,
  });
}

export function usePermitActivities(permitId: string) {
  return useQuery({
    queryKey: permitAgentKeys.activities(permitId),
    queryFn: () => listActivities(permitId),
    enabled: !!permitId,
  });
}

export function useCreateOrderPermit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrderPermitInsert) => createOrderPermit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permitAgentKeys.all });
    },
  });
}

export function useUpdateOrderPermit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: OrderPermitUpdate }) =>
      updateOrderPermit(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permitAgentKeys.all });
    },
  });
}

export function useDeleteOrderPermit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOrderPermit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permitAgentKeys.all });
    },
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PermitActivityLogInsert) => createActivity(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: permitAgentKeys.activities(variables.order_permit_id),
      });
      queryClient.invalidateQueries({ queryKey: permitAgentKeys.pipeline() });
    },
  });
}

export function useInitializePermits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: initializePermitsForOrders,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permitAgentKeys.all });
    },
  });
}
