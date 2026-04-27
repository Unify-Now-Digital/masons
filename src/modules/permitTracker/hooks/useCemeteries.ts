import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { Cemetery } from '../types/permitTracker.types';

export const cemeteriesQueryKeys = {
  all: (organizationId: string) => ['cemeteries', 'all', organizationId] as const,
};

async function fetchCemeteries(): Promise<Cemetery[]> {
  // Cemeteries table is currently org-agnostic (see migration 20260402120000); the
  // RLS policy allows full access. Caller passes organizationId to keep the cache
  // partitioned per-tenant in case that policy tightens later.
  const { data, error } = await supabase
    .from('cemeteries')
    .select('id, name, primary_email, phone, address, avg_approval_days, notes, created_at, updated_at')
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Cemetery[];
}

/** Cached list of cemeteries; used by the inbox bucket classifier and chase templates. */
export function useCemeteries() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? cemeteriesQueryKeys.all(organizationId) : ['cemeteries', 'disabled'],
    queryFn: fetchCemeteries,
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}
