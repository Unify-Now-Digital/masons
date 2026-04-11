import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';

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
  list: (organizationId: string, invoiceId?: string) =>
    ['payments', 'list', organizationId, invoiceId ?? 'all'] as const,
  byInvoice: (invoiceId: string, organizationId: string) =>
    ['payments', 'invoice', invoiceId, organizationId] as const,
  detail: (id: string, organizationId: string) => ['payments', id, organizationId] as const,
};

async function fetchPayments(organizationId: string, invoiceId?: string) {
  let query = supabase
    .from('payments')
    .select('*')
    .eq('organization_id', organizationId)
    .order('date', { ascending: false });

  if (invoiceId) {
    query = query.eq('invoice_id', invoiceId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Payment[];
}

async function fetchPayment(id: string, organizationId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single();

  if (error) throw error;
  return data as Payment;
}

async function createPayment(payment: PaymentInsert, organizationId: string) {
  const { data, error } = await supabase
    .from('payments')
    .insert({ ...payment, organization_id: organizationId })
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
  const { error } = await supabase.from('payments').delete().eq('id', id);

  if (error) throw error;
}

export function usePaymentsList(invoiceId?: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? paymentsKeys.list(organizationId, invoiceId)
      : ['payments', 'list', 'disabled', invoiceId],
    queryFn: () => fetchPayments(organizationId!, invoiceId),
    enabled: !!organizationId,
  });
}

export function usePayment(id: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      id && organizationId
        ? paymentsKeys.detail(id, organizationId)
        : ['payments', id, 'disabled'],
    queryFn: () => fetchPayment(id, organizationId!),
    enabled: !!id && !!organizationId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (payment: PaymentInsert) => {
      if (!organizationId) throw new Error('No organization selected');
      return createPayment(payment, organizationId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: paymentsKeys.list(organizationId) });
        queryClient.invalidateQueries({
          queryKey: paymentsKeys.byInvoice(data.invoice_id, organizationId),
        });
      }
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: PaymentUpdate }) =>
      updatePayment(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: paymentsKeys.list(organizationId) });
        queryClient.invalidateQueries({
          queryKey: paymentsKeys.byInvoice(data.invoice_id, organizationId),
        });
        queryClient.setQueryData(paymentsKeys.detail(data.id, organizationId), data);
      }
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: paymentsKeys.list(organizationId) });
      }
    },
  });
}
