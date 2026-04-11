import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchPermitOrders } from '../api/permitTracker.api';

export const permitTrackerKeys = {
  orders: (organizationId: string) => ['permitTracker', 'orders', organizationId] as const,
  comments: (organizationId: string, orderId: string) =>
    ['permitTracker', 'comments', organizationId, orderId] as const,
};

async function fetchPermitOrdersWithFallback(organizationId: string) {
  try {
    const orders = await fetchPermitOrders(organizationId);
    return { orders };
  } catch {
    return { orders: [] };
  }
}

/**
 * Fetch all active permit orders with realtime subscription.
 */
export function usePermitOrders() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  const query = useQuery({
    queryKey: organizationId
      ? permitTrackerKeys.orders(organizationId)
      : ['permitTracker', 'orders', 'disabled'],
    queryFn: () => fetchPermitOrdersWithFallback(organizationId!),
    enabled: !!organizationId,
  });

  // Subscribe to realtime changes on orders with active permit statuses
  useEffect(() => {
    if (!organizationId) return;

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
          queryClient.invalidateQueries({ queryKey: permitTrackerKeys.orders(organizationId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, organizationId]);

  return {
    ...query,
    data: query.data?.orders,
  };
}
