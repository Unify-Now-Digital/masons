import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useTestDataMode } from '@/shared/context/TestDataContext';
import type { Cemetery } from '@/modules/permitTracker/types/permitTracker.types';

export type { Cemetery };

export type CemeteryInsert = Omit<Cemetery, 'id' | 'created_at' | 'updated_at'>;
export type CemeteryUpdate = Partial<CemeteryInsert>;

export interface CemeteryWithCounts extends Cemetery {
  orderCount: number;
  permitFormCount: number;
}

export const cemeteriesKeys = {
  all: ['cemeteries'] as const,
  list: (organizationId: string) => ['cemeteries', 'list', organizationId] as const,
  detail: (id: string, organizationId: string) => ['cemeteries', id, organizationId] as const,
};

async function fetchCemeteriesWithCounts(
  organizationId: string,
  options: { excludeTest?: boolean } = {}
): Promise<CemeteryWithCounts[]> {
  // Cemeteries are shared reference data — show every row regardless of
  // which organisation owns it. Order/permit counts below stay scoped to
  // the active org so the numbers remain meaningful per tenant.
  let cemeteriesQ = supabase
    .from('cemeteries')
    .select('id, name, primary_email, phone, address, avg_approval_days, notes, created_at, updated_at')
    .order('name', { ascending: true });
  let ordersQ = supabase
    .from('orders')
    .select('cemetery_id')
    .eq('organization_id', organizationId)
    .not('cemetery_id', 'is', null);
  if (options.excludeTest) {
    cemeteriesQ = cemeteriesQ.eq('is_test', false);
    ordersQ = ordersQ.eq('is_test', false);
  }
  const [cemeteriesRes, orderCountsRes, permitFormCountsRes] = await Promise.all([
    cemeteriesQ,
    ordersQ,
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

async function createCemetery(payload: CemeteryInsert, organizationId: string) {
  const { data, error } = await supabase
    .from('cemeteries')
    .insert({ ...payload, organization_id: organizationId })
    .select()
    .single();
  if (error) throw error;
  return data as Cemetery;
}

async function updateCemetery(id: string, updates: CemeteryUpdate) {
  const { data, error } = await supabase
    .from('cemeteries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Cemetery;
}

async function deleteCemetery(id: string) {
  const { error } = await supabase.from('cemeteries').delete().eq('id', id);
  if (error) throw error;
}

export function useCemeteriesList() {
  const { organizationId } = useOrganization();
  const { showTestData } = useTestDataMode();
  const excludeTest = !showTestData;
  return useQuery({
    queryKey: organizationId
      ? [...cemeteriesKeys.list(organizationId), { excludeTest }]
      : ['cemeteries', 'list', 'disabled'],
    queryFn: () => fetchCemeteriesWithCounts(organizationId!, { excludeTest }),
    enabled: !!organizationId,
  });
}

export function useCreateCemetery() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (payload: CemeteryInsert) => {
      if (!organizationId) throw new Error('No organization selected');
      return createCemetery(payload, organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cemeteriesKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: cemeteriesKeys.list(organizationId) });
      }
    },
  });
}

export function useUpdateCemetery() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CemeteryUpdate }) =>
      updateCemetery(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cemeteriesKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: cemeteriesKeys.list(organizationId) });
      }
    },
  });
}

export function useDeleteCemetery() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (id: string) => deleteCemetery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cemeteriesKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: cemeteriesKeys.list(organizationId) });
      }
    },
  });
}
