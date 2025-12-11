import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

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
  detail: (id: string) => ['companies', id] as const,
};

async function fetchCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data as Company[];
}

async function fetchCompany(id: string) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Company;
}

async function createCompany(payload: CompanyInsert) {
  const { data, error } = await supabase
    .from('companies')
    .insert(payload)
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
  return useQuery({
    queryKey: companiesKeys.all,
    queryFn: fetchCompanies,
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: companiesKeys.detail(id),
    queryFn: () => fetchCompany(id),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CompanyInsert) => createCompany(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CompanyUpdate }) =>
      updateCompany(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
      queryClient.setQueryData(companiesKeys.detail(data.id), data);
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    },
  });
}

