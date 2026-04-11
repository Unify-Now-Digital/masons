import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';

export interface Company {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  team_members: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CompanyInsert = Omit<Company, 'id' | 'created_at' | 'updated_at'>;
export type CompanyUpdate = Partial<CompanyInsert>;

export const companiesKeys = {
  all: ['companies'] as const,
  list: (organizationId: string) => ['companies', 'list', organizationId] as const,
  detail: (id: string, organizationId: string) => ['companies', id, organizationId] as const,
};

async function fetchCompanies(organizationId: string) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data as Company[];
}

async function fetchCompany(id: string, organizationId: string) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single();

  if (error) throw error;
  return data as Company;
}

async function createCompany(payload: CompanyInsert, organizationId: string) {
  const { data, error } = await supabase
    .from('companies')
    .insert({ ...payload, organization_id: organizationId })
    .select()
    .single();

  if (error) throw error;
  return data as Company;
}

async function updateCompany(id: string, updates: CompanyUpdate) {
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Company;
}

async function deleteCompany(id: string) {
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) throw error;
}

export function useCompaniesList() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? companiesKeys.list(organizationId) : ['companies', 'list', 'disabled'],
    queryFn: () => fetchCompanies(organizationId!),
    enabled: !!organizationId,
  });
}

export function useCompany(id: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      id && organizationId ? companiesKeys.detail(id, organizationId) : ['companies', id, 'disabled'],
    queryFn: () => fetchCompany(id, organizationId!),
    enabled: !!id && !!organizationId,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (payload: CompanyInsert) => {
      if (!organizationId) throw new Error('No organization selected');
      return createCompany(payload, organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: companiesKeys.list(organizationId) });
      }
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CompanyUpdate }) =>
      updateCompany(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: companiesKeys.list(organizationId) });
        queryClient.setQueryData(companiesKeys.detail(data.id, organizationId), data);
      }
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: companiesKeys.list(organizationId) });
      }
    },
  });
}

