import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { Cemetery } from '@/modules/permitTracker/types/permitTracker.types';

export type { Cemetery };

export interface CemeteryWithCounts extends Cemetery {
  orderCount: number;
  permitFormCount: number;
}

export const cemeteriesKeys = {
  all: ['cemeteries'] as const,
  list: (organizationId: string) => ['cemeteries', 'list', organizationId] as const,
};

async function fetchCemeteriesWithCounts(organizationId: string): Promise<CemeteryWithCounts[]> {
  const [cemeteriesRes, orderCountsRes, permitFormCountsRes] = await Promise.all([
    supabase
      .from('cemeteries')
      .select('id, name, primary_email, phone, address, avg_approval_days, notes, created_at, updated_at')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true }),
    supabase
      .from('orders')
      .select('cemetery_id')
      .eq('organization_id', organizationId)
      .not('cemetery_id', 'is', null),
    supabase
      .from('permit_forms')
      .select('cemetery_id')
      .eq('organization_id', organizationId)
      .not('cemetery_id', 'is', null),
  ]);

  if (cemeteriesRes.error) throw cemeteriesRes.error;
  if (orderCountsRes.error) throw orderCountsRes.error;
  if (permitFormCountsRes.error) throw permitFormCountsRes.error;

  const orderCountMap = new Map<string, number>();
  for (const row of orderCountsRes.data ?? []) {
    if (!row.cemetery_id) continue;
    orderCountMap.set(row.cemetery_id, (orderCountMap.get(row.cemetery_id) ?? 0) + 1);
  }

  const permitFormCountMap = new Map<string, number>();
  for (const row of permitFormCountsRes.data ?? []) {
    if (!row.cemetery_id) continue;
    permitFormCountMap.set(row.cemetery_id, (permitFormCountMap.get(row.cemetery_id) ?? 0) + 1);
  }

  return (cemeteriesRes.data ?? []).map((c) => ({
    ...(c as Cemetery),
    orderCount: orderCountMap.get(c.id) ?? 0,
    permitFormCount: permitFormCountMap.get(c.id) ?? 0,
  }));
}

export function useCemeteriesList() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? cemeteriesKeys.list(organizationId)
      : ['cemeteries', 'list', 'disabled'],
    queryFn: () => fetchCemeteriesWithCounts(organizationId!),
    enabled: !!organizationId,
  });
}
