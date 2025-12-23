import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export interface Memorial {
  id: string;
  order_id: string;
  job_id: string | null;
  deceased_name: string;
  date_of_birth: string | null;
  date_of_death: string | null;
  cemetery_name: string;
  cemetery_section: string | null;
  cemetery_plot: string | null;
  memorial_type: string;
  name: string | null;
  price: number | null;
  material: string | null;
  color: string | null;
  dimensions: string | null;
  inscription_text: string | null;
  inscription_language: string | null;
  installation_date: string | null;
  status: 'planned' | 'in_progress' | 'installed' | 'removed';
  condition: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type MemorialInsert = Omit<Memorial, 'id' | 'created_at' | 'updated_at'>;
export type MemorialUpdate = Partial<MemorialInsert>;

export const memorialsKeys = {
  all: ['memorials'] as const,
  detail: (id: string) => ['memorials', id] as const,
};

const MEMORIAL_FIELDS = [
  'id',
  'order_id',
  'job_id',
  'deceased_name',
  'date_of_birth',
  'date_of_death',
  'cemetery_name',
  'cemetery_section',
  'cemetery_plot',
  'memorial_type',
  'name',
  'price',
  'material',
  'color',
  'dimensions',
  'inscription_text',
  'inscription_language',
  'installation_date',
  'status',
  'condition',
  'notes',
  'created_at',
  'updated_at',
].join(', ');

async function fetchMemorials() {
  const { data, error } = await supabase
    .from('memorials')
    .select(MEMORIAL_FIELDS)
    .order('installation_date', { ascending: false, nullsLast: true })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Memorial[];
}

async function fetchMemorial(id: string) {
  const { data, error } = await supabase
    .from('memorials')
    .select(MEMORIAL_FIELDS)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Memorial;
}

async function createMemorial(memorial: MemorialInsert) {
  const { data, error } = await supabase
    .from('memorials')
    .insert(memorial)
    .select(MEMORIAL_FIELDS)
    .single();
  
  if (error) throw error;
  return data as Memorial;
}

async function updateMemorial(id: string, updates: MemorialUpdate) {
  const { data, error } = await supabase
    .from('memorials')
    .update(updates)
    .eq('id', id)
    .select(MEMORIAL_FIELDS)
    .single();
  
  if (error) throw error;
  return data as Memorial;
}

async function deleteMemorial(id: string) {
  const { error } = await supabase
    .from('memorials')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export function useMemorialsList() {
  return useQuery({
    queryKey: memorialsKeys.all,
    queryFn: fetchMemorials,
  });
}

export function useMemorial(id: string) {
  return useQuery({
    queryKey: memorialsKeys.detail(id),
    queryFn: () => fetchMemorial(id),
    enabled: !!id,
  });
}

export function useCreateMemorial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (memorial: MemorialInsert) => createMemorial(memorial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memorialsKeys.all });
    },
  });
}

export function useUpdateMemorial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MemorialUpdate }) => 
      updateMemorial(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: memorialsKeys.all });
      queryClient.setQueryData(memorialsKeys.detail(data.id), data);
    },
  });
}

export function useDeleteMemorial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteMemorial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memorialsKeys.all });
    },
  });
}

