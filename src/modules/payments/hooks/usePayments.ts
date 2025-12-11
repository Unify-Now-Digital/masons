import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  date: string;
  method: 'cash' | 'card' | 'bank_transfer' | 'check' | 'online' | 'other';
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentInsert = Omit<Payment, 'id' | 'created_at' | 'updated_at'>;
export type PaymentUpdate = Partial<PaymentInsert>;

export const paymentsKeys = {
  all: ['payments'] as const,
  byInvoice: (invoiceId: string) => ['payments', 'invoice', invoiceId] as const,
  detail: (id: string) => ['payments', id] as const,
};

async function fetchPayments(invoiceId?: string) {
  let query = supabase
    .from('payments')
    .select('*')
    .order('date', { ascending: false });
  
  if (invoiceId) {
    query = query.eq('invoice_id', invoiceId);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as Payment[];
}

async function fetchPayment(id: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Payment;
}

async function createPayment(payment: PaymentInsert) {
  const { data, error } = await supabase
    .from('payments')
    .insert(payment)
    .select()
    .single();
  
  if (error) {
    throw new Error(error.message || 'Failed to create payment');
  }
  return data as Payment;
}

async function updatePayment(id: string, updates: PaymentUpdate) {
  const { data, error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Payment;
}

async function deletePayment(id: string) {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export function usePaymentsList(invoiceId?: string) {
  return useQuery({
    queryKey: invoiceId ? paymentsKeys.byInvoice(invoiceId) : paymentsKeys.all,
    queryFn: () => fetchPayments(invoiceId),
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: paymentsKeys.detail(id),
    queryFn: () => fetchPayment(id),
    enabled: !!id,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payment: PaymentInsert) => createPayment(payment),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
      queryClient.invalidateQueries({ queryKey: paymentsKeys.byInvoice(data.invoice_id) });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: PaymentUpdate }) => 
      updatePayment(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
      queryClient.invalidateQueries({ queryKey: paymentsKeys.byInvoice(data.invoice_id) });
      queryClient.setQueryData(paymentsKeys.detail(data.id), data);
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
    },
  });
}

