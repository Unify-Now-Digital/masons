import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchInvoices, fetchInvoice, createInvoice, updateInvoice, deleteInvoice, fetchInvoicePayments } from '../api/invoicing.api';
import type { InvoiceInsert, InvoiceUpdate } from '../types/invoicing.types';

export const invoicesKeys = {
  all: ['invoices'] as const,
  detail: (id: string) => ['invoices', id] as const,
  payments: (invoiceId: string) => ['invoices', invoiceId, 'payments'] as const,
};

export function useInvoicesList() {
  return useQuery({
    queryKey: invoicesKeys.all,
    queryFn: fetchInvoices,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoicesKeys.detail(id),
    queryFn: () => fetchInvoice(id),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (invoice: InvoiceInsert) => createInvoice(invoice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: InvoiceUpdate }) => 
      updateInvoice(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      queryClient.setQueryData(invoicesKeys.detail(data.id), data);
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      if (id) {
        queryClient.removeQueries({ queryKey: invoicesKeys.detail(id), exact: true });
      }
    },
  });
}

export function useInvoicePayments(invoiceId: string | null) {
  return useQuery({
    queryKey: invoicesKeys.payments(invoiceId ?? ''),
    queryFn: () => fetchInvoicePayments(invoiceId!),
    enabled: !!invoiceId,
  });
}

