import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { fetchPermitOrders } from '../api/permitTracker.api';
import { SAMPLE_PERMIT_ORDERS } from '../utils/sampleData';

export const permitTrackerKeys = {
  orders: ['permitTracker', 'orders'] as const,
  comments: (orderId: string) => ['permitTracker', 'comments', orderId] as const,
};

/**
 * Fetch permit orders from Supabase, falling back to sample data
 * if the migration hasn't been applied yet.
 */
async function fetchPermitOrdersWithFallback() {
  try {
    const orders = await fetchPermitOrders();
    return { orders, usingSample: false };
  } catch {
    // Migration not applied or query failed — use sample data
    return { orders: SAMPLE_PERMIT_ORDERS, usingSample: true };
  }
}

/**
 * Fetch all active permit orders with realtime subscription.
 * Falls back to sample data if the database columns don't exist yet.
 */
export function usePermitOrders() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: permitTrackerKeys.orders,
    queryFn: fetchPermitOrdersWithFallback,
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

  return {
    ...query,
    data: query.data?.orders,
    usingSample: query.data?.usingSample ?? false,
  };
}
