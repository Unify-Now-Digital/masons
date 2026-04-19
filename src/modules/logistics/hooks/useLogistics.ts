import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchLogistics } from '../api/logistics.api';

export function useLogistics() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['logistics', organizationId] : ['logistics', 'disabled'],
    queryFn: () => fetchLogistics(organizationId!),
    enabled: !!organizationId,
  });
}
