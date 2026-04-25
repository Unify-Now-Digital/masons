import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { Order } from '@/modules/orders/types/orders.types';
import { normalizeOrder } from '@/modules/orders/utils/numberParsing';
import { useOrganization } from '@/shared/context/OrganizationContext';

export const mappingKeys = {
  all: ['mapping'] as const,
  schedulable: (organizationId: string) =>
    ['mapping', 'schedulable', organizationId] as const,
};

/**
 * Orders eligible for auto-scheduling: lettering done, council permit
 * approved, and the stone is physically in stock. Restricted to rows with
 * geocoded coordinates so they can land on the map.
 */
async function fetchSchedulable(organizationId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders_with_options_total')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('proof_status', 'Lettered')
    .eq('permit_status', 'approved')
    .eq('stone_status', 'In Stock')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('location', { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeOrder);
}

export function useSchedulableOrders() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? mappingKeys.schedulable(organizationId)
      : ['mapping', 'schedulable', 'disabled'],
    queryFn: () => fetchSchedulable(organizationId!),
    enabled: !!organizationId,
  });
}

interface BulkUpdate {
  date: string | null;
  orderIds: string[];
}

async function bulkUpdateInstallationDate({ date, orderIds }: BulkUpdate) {
  if (orderIds.length === 0) return;
  const { error } = await supabase
    .from('orders')
    .update({ installation_date: date })
    .in('id', orderIds);
  if (error) throw error;
}

export function useUpdateInstallationDates() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: bulkUpdateInstallationDate,
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: mappingKeys.schedulable(organizationId),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['map', 'orders'] });
    },
  });
}
