import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { fetchPermitOrders } from '../api/permitTracker.api';

export const permitTrackerKeys = {
  orders: ['permitTracker', 'orders'] as const,
  comments: (orderId: string) => ['permitTracker', 'comments', orderId] as const,
};

/**
 * Fetch all active permit orders with realtime subscription.
 */
export function usePermitOrders() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: permitTrackerKeys.orders,
    queryFn: fetchPermitOrders,
  });

  // Subscribe to realtime changes on orders with active permit statuses
  useEffect(() => {
    const channel = supabase
      .channel('permit-tracker-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: permitTrackerKeys.orders });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
