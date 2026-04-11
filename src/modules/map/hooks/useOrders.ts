import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { Order } from '@/modules/orders/types/orders.types';
import { normalizeOrder } from '@/modules/orders/utils/numberParsing';
import { useOrganization } from '@/shared/context/OrganizationContext';

export const mapOrdersKeys = {
  all: ['map', 'orders'] as const,
  list: (organizationId: string) => ['map', 'orders', organizationId] as const,
};

async function fetchOrdersForMap(organizationId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders_with_options_total')
    .select('*')
    .eq('organization_id', organizationId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(normalizeOrder);
}

export function useOrdersForMap() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? mapOrdersKeys.list(organizationId) : ['map', 'orders', 'disabled'],
    queryFn: () => fetchOrdersForMap(organizationId!),
    enabled: !!organizationId,
  });
}

