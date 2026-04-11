import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { createOrderComment, fetchOrderComments } from '../api/permitTracker.api';
import type { OrderCommentInsert } from '../types/permitTracker.types';
import { permitTrackerKeys } from './usePermitOrders';

export function useOrderCommentsList(orderId: string | null) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      orderId && organizationId
        ? permitTrackerKeys.comments(organizationId, orderId)
        : ['permitTracker', 'comments', 'disabled'],
    queryFn: () => fetchOrderComments(organizationId!, orderId!),
    enabled: !!orderId && !!organizationId,
  });
}

export function useCreateOrderComment() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (comment: OrderCommentInsert) => {
      if (!organizationId) throw new Error('No organization selected');
      return createOrderComment(organizationId, comment);
    },
    onSuccess: (data) => {
      if (!organizationId) return;
      queryClient.invalidateQueries({
        queryKey: permitTrackerKeys.comments(organizationId, data.order_id),
      });
    },
  });
}
