import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  fetchFinanceTotals,
  fetchFinanceAtRisk,
  fetchFinanceRecentPayments,
} from '../api/finance.api';

export function useFinanceTotals() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['finance', 'totals', organizationId] : ['finance', 'totals', 'disabled'],
    queryFn: () => fetchFinanceTotals(organizationId!),
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
