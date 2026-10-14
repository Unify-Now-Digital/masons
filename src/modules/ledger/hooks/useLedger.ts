import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  allocatePayment, confirmSuggestion, fetchLedgerPayments, fetchLedgerTotals, ignorePayment, LedgerUnavailable,
  unmatchPayment, type AllocationInput, type LedgerFilters,
} from '../api/ledger.api';

const retry = (n: number, e: unknown) => !(e instanceof LedgerUnavailable) && n < 2;

export function useLedgerPayments(filters: LedgerFilters) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: ['ledger', 'payments', organizationId, filters],
    queryFn: () => fetchLedgerPayments(organizationId!, filters),
    enabled: !!organizationId,
    retry,
  });
}

export function useLedgerTotals(from: string, to: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: ['ledger', 'totals', organizationId, from, to],
    queryFn: () => fetchLedgerTotals(organizationId!, from, to),
    enabled: !!organizationId && !!from && !!to,
    retry,
  });
}

/** Every ledger action refreshes the ledger, invoices, orders and money tiles. */
function useLedgerAction<V>(fn: (v: V) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [['ledger'], ['invoices'], ['orders'], ['finance'], ['hub'], ['sections']]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export const useConfirmSuggestion = () =>
  useLedgerAction((v: { paymentId: string; invoiceId: string | null; orderId: string | null }) => confirmSuggestion(v.paymentId, v.invoiceId, v.orderId));
export const useAllocatePayment = () =>
  useLedgerAction((v: { paymentId: string; allocations: AllocationInput[]; note?: string }) => allocatePayment(v.paymentId, v.allocations, v.note));
export const useUnmatchPayment = () => useLedgerAction((v: { paymentId: string; reason: string }) => unmatchPayment(v.paymentId, v.reason));
export const useIgnorePayment = () => useLedgerAction((v: { paymentId: string; reason: string }) => ignorePayment(v.paymentId, v.reason));
