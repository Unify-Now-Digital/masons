import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export interface Inscription {
  id: string;
  order_id: string;
  inscription_text: string;
  type: 'front' | 'back' | 'side' | 'plaque' | 'additional';
  style: string | null;
  color: 'gold' | 'silver' | 'white' | 'black' | 'natural' | 'other' | null;
  proof_url: string | null;
  status: 'pending' | 'proofing' | 'approved' | 'engraving' | 'completed' | 'installed';
  engraved_by: string | null;
  engraved_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InscriptionInsert = Omit<Inscription, 'id' | 'created_at' | 'updated_at'>;
export type InscriptionUpdate = Partial<InscriptionInsert>;

export const inscriptionsKeys = {
  all: ['inscriptions'] as const,
  byOrder: (orderId: string) => ['inscriptions', 'order', orderId] as const,
  detail: (id: string) => ['inscriptions', id] as const,
};

async function fetchInscriptions(orderId?: string) {
  let query = supabase
    .from('inscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (orderId) {
    query = query.eq('order_id', orderId);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as Inscription[];
}

async function fetchInscription(id: string) {
  const { data, error } = await supabase
    .from('inscriptions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Inscription;
}

async function createInscription(inscription: InscriptionInsert) {
  const { data, error } = await supabase
    .from('inscriptions')
    .insert(inscription)
    .select()
    .single();
  
  if (error) {
    throw new Error(error.message || 'Failed to create inscription');
  }
  return data as Inscription;
}

async function updateInscription(id: string, updates: InscriptionUpdate) {
  const { data, error } = await supabase
    .from('inscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Inscription;
}

async function deleteInscription(id: string) {
  const { error } = await supabase
    .from('inscriptions')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export function useInscriptionsList(orderId?: string) {
  return useQuery({
    queryKey: orderId ? inscriptionsKeys.byOrder(orderId) : inscriptionsKeys.all,
    queryFn: () => fetchInscriptions(orderId),
  });
}

export function useInscription(id: string) {
  return useQuery({
    queryKey: inscriptionsKeys.detail(id),
    queryFn: () => fetchInscription(id),
    enabled: !!id,
  });
}

export function useCreateInscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (inscription: InscriptionInsert) => createInscription(inscription),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(data.order_id) });
    },
  });
}

export function useUpdateInscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: InscriptionUpdate }) => 
      updateInscription(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(data.order_id) });
      queryClient.setQueryData(inscriptionsKeys.detail(data.id), data);
    },
  });
}

export function useDeleteInscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteInscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
    },
  });
}

