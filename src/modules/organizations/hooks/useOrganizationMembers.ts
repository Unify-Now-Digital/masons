import { useQuery } from '@tanstack/react-query';
import { fetchOrganizationMembers } from '@/modules/organizations/api/organizationMembers.api';
import { useOrganization } from '@/shared/context/OrganizationContext';

export const organizationMembersKeys = {
  list: (organizationId: string) => ['organizationMembers', organizationId] as const,
};

export function useOrganizationMembers() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? organizationMembersKeys.list(organizationId) : ['organizationMembers', 'disabled'],
    queryFn: () => fetchOrganizationMembers(organizationId!),
    enabled: !!organizationId,
  });
}
