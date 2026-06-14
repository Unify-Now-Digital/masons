import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { buildFinanceHubSummary, fetchFinanceHubInvoices } from '../api/finance.hub.api';

export function useFinanceHub(options?: { enabled?: boolean }) {
  const { organizationId } = useOrganization();
  const enabled = !!organizationId && (options?.enabled ?? true);

  return useQuery({
    queryKey: organizationId ? ['finance', 'hub', organizationId] : ['finance', 'hub', 'disabled'],
    queryFn: async () => {
      const rows = await fetchFinanceHubInvoices(organizationId!);
      return buildFinanceHubSummary(rows);
    },
    enabled,
  });
}
