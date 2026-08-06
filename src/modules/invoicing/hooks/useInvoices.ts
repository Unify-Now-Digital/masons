import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useTestDataMode } from '@/shared/context/TestDataContext';
import { fetchInvoices, fetchInvoice, createInvoice, updateInvoice, deleteInvoice, fetchInvoicePayments } from '../api/invoicing.api';
import type { InvoiceInsert, InvoiceUpdate } from '../types/invoicing.types';
import { autoAdvanceJobStage, jobsPipelineKeys } from '@/modules/jobsPipeline';

export const invoicesKeys = {
  all: ['invoices'] as const,
  list: (organizationId: string) => ['invoices', 'list', organizationId] as const,
  detail: (id: string, organizationId: string) => ['invoices', id, organizationId] as const,
  payments: (invoiceId: string, organizationId: string) =>
    ['invoices', invoiceId, 'payments', organizationId] as const,
};

export function useInvoicesList() {
  const { organizationId } = useOrganization();
  const { showTestData } = useTestDataMode();
  const excludeTest = !showTestData;
  return useQuery({
    queryKey: organizationId
      ? [...invoicesKeys.list(organizationId), { excludeTest }]
      : ['invoices', 'list', 'disabled'],
    queryFn: () => fetchInvoices(organizationId!, { excludeTest }),
    enabled: !!organizationId,
  });
}

export function useInvoice(id: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      id && organizationId ? invoicesKeys.detail(id, organizationId) : ['invoices', id, 'disabled'],
    queryFn: () => fetchInvoice(id, organizationId!),
    enabled: !!id && !!organizationId,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (invoice: InvoiceInsert) => {
      if (!organizationId) {
        throw new Error('Cannot create invoice: no active organization');
      }
      return createInvoice({ ...invoice, organization_id: organizationId });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: invoicesKeys.list(organizationId) });
        if (data.job_id) {
          // Card totals + Invoiced-gate summary changed even if the stage doesn't move.
          queryClient.invalidateQueries({
            queryKey: jobsPipelineKeys.invoiceSummaries(organizationId),
          });
          // Stage automation: invoice created on a job advances it to 'invoiced'.
          // Fire-and-forget — a failure here must never fail the created invoice.
          void autoAdvanceJobStage({ organizationId, jobId: data.job_id, targetStage: 'invoiced' })
            .then((advanced) => {
              if (!advanced) return;
              queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.active(organizationId) });
              queryClient.invalidateQueries({
                queryKey: jobsPipelineKeys.afterPaid(organizationId),
              });
            })
            .catch((err) => {
              console.warn('[jobsPipeline] auto-advance failed (creation succeeded)', err);
            });
        }
      }
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: InvoiceUpdate }) =>
      updateInvoice(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: invoicesKeys.list(organizationId) });
        queryClient.setQueryData(invoicesKeys.detail(data.id, organizationId), data);
      }
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: invoicesKeys.list(organizationId) });
      }
      if (id && organizationId) {
        queryClient.removeQueries({
          queryKey: invoicesKeys.detail(id, organizationId),
          exact: true,
        });
      }
    },
  });
}

export function useInvoicePayments(invoiceId: string | null) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      invoiceId && organizationId
        ? invoicesKeys.payments(invoiceId, organizationId)
        : ['invoices', invoiceId ?? '', 'payments', 'disabled'],
    queryFn: () => fetchInvoicePayments(invoiceId!),
    enabled: !!invoiceId && !!organizationId,
  });
}

