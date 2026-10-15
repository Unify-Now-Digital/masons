import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  fetchFinanceTotals,
  fetchFinanceAtRisk,
  fetchFinanceRecentPayments,
  fetchConfirmedOrdersStat,
  fetchFinanceCards,
  fetchUnmatchedInvoices,
  fetchLinkableOrders,
} from '../api/finance.api';

// Stat-strip only: skipped when the role cannot see the strip (canViewFinancials).
export function useFinanceTotals() {
  const { organizationId, canViewFinancials } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['finance', 'totals', organizationId] : ['finance', 'totals', 'disabled'],
    queryFn: () => fetchFinanceTotals(organizationId!),
    enabled: !!organizationId && canViewFinancials,
  });
}

/**
 * C7 (FR-023): Confirmed-orders stat — count + total_order_value on the job-stage axis.
 * Stat-strip only: skipped when the role cannot see the strip (canViewFinancials).
 */
export function useConfirmedOrdersStat() {
  const { organizationId, canViewFinancials } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? ['finance', 'confirmed-orders', organizationId]
      : ['finance', 'confirmed-orders', 'disabled'],
    queryFn: () => fetchConfirmedOrdersStat(organizationId!),
    enabled: !!organizationId && canViewFinancials,
  });
}

export function useFinanceAtRisk() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['finance', 'at-risk', organizationId] : ['finance', 'at-risk', 'disabled'],
    queryFn: () => fetchFinanceAtRisk(organizationId!),
    enabled: !!organizationId,
  });
}

export function useFinanceRecentPayments() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? ['finance', 'recent-payments', organizationId]
      : ['finance', 'recent-payments', 'disabled'],
    queryFn: () => fetchFinanceRecentPayments(organizationId!),
    enabled: !!organizationId,
    retry: 1,
  });
}

/** New stat strip (Order book … Unmatched). Gated like the old strip. */
export function useFinanceCards() {
  const { organizationId, canViewFinancials } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['finance', 'cards', organizationId] : ['finance', 'cards', 'disabled'],
    queryFn: () => fetchFinanceCards(organizationId!),
    enabled: !!organizationId && canViewFinancials,
  });
}

export function useUnmatchedInvoices(enabled = true) {
  const { organizationId, canViewFinancials } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['finance', 'unmatched', organizationId] : ['finance', 'unmatched', 'disabled'],
    queryFn: () => fetchUnmatchedInvoices(organizationId!),
    enabled: enabled && !!organizationId && canViewFinancials,
  });
}

export function useLinkableOrders(enabled: boolean) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['finance', 'linkable-orders', organizationId] : ['finance', 'linkable-orders', 'disabled'],
    queryFn: () => fetchLinkableOrders(organizationId!),
    enabled: enabled && !!organizationId,
  });
}
