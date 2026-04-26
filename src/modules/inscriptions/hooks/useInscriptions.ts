import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useTestDataMode } from '@/shared/context/TestDataContext';

export interface Inscription {
  id: string;
  order_id: string | null;
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

async function fetchInscriptions(
  orderId?: string | null,
  options: { excludeTest?: boolean } = {}
) {
  let query = supabase
    .from('inscriptions')
    .select('*')
    .order('created_at', { ascending: false });

  if (orderId) {
    query = query.eq('order_id', orderId);
  }
  if (options.excludeTest) {
    query = query.eq('is_test', false);
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

export function useInscriptionsList(orderId?: string | null) {
  const { showTestData } = useTestDataMode();
  const excludeTest = !showTestData;
  return useQuery({
    queryKey: orderId
      ? [...inscriptionsKeys.byOrder(orderId), { excludeTest }]
      : [...inscriptionsKeys.all, { excludeTest }],
    queryFn: () => fetchInscriptions(orderId, { excludeTest }),
  });
}

export function useInscriptionsByOrderId(orderId: string | null | undefined) {
  return useQuery({
    queryKey: inscriptionsKeys.byOrder(orderId || ''),
    queryFn: () => fetchInscriptions(orderId),
    enabled: !!orderId, // Only fetch if orderId exists
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
      if (data.order_id) {
        queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(data.order_id) });
      }
    },
  });
}

export function useUpdateInscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: InscriptionUpdate }) => 
      updateInscription(id, updates),
    onMutate: async ({ id }) => {
      // Capture old inscription from cache before update to track order_id changes
      const oldInscription = queryClient.getQueryData<Inscription>(inscriptionsKeys.detail(id));
      return { oldOrderId: oldInscription?.order_id ?? null };
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
      queryClient.setQueryData(inscriptionsKeys.detail(data.id), data);
      
      const oldOrderId = context?.oldOrderId ?? null;
      const newOrderId = data.order_id ?? null;
      
      // If order_id changed, invalidate both old and new order caches
      if (oldOrderId !== newOrderId) {
        if (oldOrderId) {
          queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(oldOrderId) });
        }
        if (newOrderId) {
          queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(newOrderId) });
        }
      } else if (newOrderId) {
        // Order_id didn't change, but still invalidate the cache
        queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(newOrderId) });
      }
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

