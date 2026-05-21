import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  fetchFinanceInvoices,
  type FinanceInvoiceStatusFilter,
} from '../api/finance.invoices.api';

export function useFinanceInvoices(
  filter: FinanceInvoiceStatusFilter,
  options?: { enabled?: boolean },
) {
  const { organizationId } = useOrganization();
  const enabled = !!organizationId && (options?.enabled ?? true);

  return useQuery({
    queryKey: organizationId
      ? ['finance', 'invoices', organizationId, filter]
      : ['finance', 'invoices', 'disabled', filter],
    queryFn: () => fetchFinanceInvoices(organizationId!, filter),
    enabled,
  });
}
