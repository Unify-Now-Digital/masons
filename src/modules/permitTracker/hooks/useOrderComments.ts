import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createOrderComment, fetchOrderComments } from '../api/permitTracker.api';
import type { OrderCommentInsert } from '../types/permitTracker.types';
import { permitTrackerKeys } from './usePermitOrders';

export function useOrderCommentsList(orderId: string | null) {
  return useQuery({
    queryKey: orderId ? permitTrackerKeys.comments(orderId) : ['permitTracker', 'comments', 'disabled'],
    queryFn: () => fetchOrderComments(orderId!),
    enabled: !!orderId,
  });
}

export function useCreateOrderComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (comment: OrderCommentInsert) => createOrderComment(comment),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: permitTrackerKeys.comments(data.order_id),
      });
    },
  });
}
