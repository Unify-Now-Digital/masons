import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
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
  pipeline: (organizationId: string) => ['permitAgent', 'pipeline', organizationId] as const,
  detail: (id: string, organizationId: string) => ['permitAgent', 'detail', id, organizationId] as const,
  activities: (organizationId: string, permitId: string) =>
    ['permitAgent', 'activities', organizationId, permitId] as const,
};

export function usePermitPipeline() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? permitAgentKeys.pipeline(organizationId)
      : ['permitAgent', 'pipeline', 'disabled'],
    queryFn: () => fetchPermitPipeline(organizationId!),
    enabled: !!organizationId,
  });
}

export function useOrderPermit(id: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      id && organizationId
        ? permitAgentKeys.detail(id, organizationId)
        : ['permitAgent', 'detail', 'disabled', id],
    queryFn: () => getOrderPermit(id, organizationId!),
    enabled: !!id && !!organizationId,
  });
}

export function usePermitActivities(permitId: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      permitId && organizationId
        ? permitAgentKeys.activities(organizationId, permitId)
        : ['permitAgent', 'activities', 'disabled'],
    queryFn: () => listActivities(organizationId!, permitId),
    enabled: !!permitId && !!organizationId,
  });
}

export function useCreateOrderPermit() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (payload: OrderPermitInsert) => {
      if (!organizationId) throw new Error('No organization selected');
      return createOrderPermit(payload, organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permitAgentKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: permitAgentKeys.pipeline(organizationId) });
      }
    },
  });
}

export function useUpdateOrderPermit() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: OrderPermitUpdate }) =>
      updateOrderPermit(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permitAgentKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: permitAgentKeys.pipeline(organizationId) });
      }
    },
  });
}

export function useDeleteOrderPermit() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (id: string) => deleteOrderPermit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permitAgentKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: permitAgentKeys.pipeline(organizationId) });
      }
    },
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (payload: PermitActivityLogInsert) => {
      if (!organizationId) throw new Error('No organization selected');
      return createActivity(payload, organizationId);
    },
    onSuccess: (_data, variables) => {
      if (!organizationId) return;
      queryClient.invalidateQueries({
        queryKey: permitAgentKeys.activities(organizationId, variables.order_permit_id),
      });
      queryClient.invalidateQueries({ queryKey: permitAgentKeys.pipeline(organizationId) });
    },
  });
}

export function useInitializePermits() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error('No organization selected');
      return initializePermitsForOrders(organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permitAgentKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: permitAgentKeys.pipeline(organizationId) });
      }
    },
  });
}
