import { useOrganization } from '@/shared/context/OrganizationContext';

/** True only once the role is known and it can view financials (same rule as RequireFinancials). */
export function useCanSeeMoney(): boolean {
  const { isLoading, role, canViewFinancials } = useOrganization();
  return !isLoading && role !== null && !!canViewFinancials;
}
