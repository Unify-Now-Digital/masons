import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  fetchFinanceTotals,
  fetchFinanceAtRisk,
  fetchFinanceRecentPayments,
  fetchConfirmedOrdersStat,
} from '../api/finance.api';

export function useFinanceTotals() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['finance', 'totals', organizationId] : ['finance', 'totals', 'disabled'],
    queryFn: () => fetchFinanceTotals(organizationId!),
    enabled: !!organizationId,
  });
}

/** C7 (FR-023): Confirmed-orders stat — count + total_order_value on the job-stage axis. */
export function useConfirmedOrdersStat() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? ['finance', 'confirmed-orders', organizationId]
      : ['finance', 'confirmed-orders', 'disabled'],
    queryFn: () => fetchConfirmedOrdersStat(organizationId!),
    enabled: !!organizationId,
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
  });
}
