import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchPermitsPipeline } from '../api/permitChase.api';

export function usePermitsPipeline() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['permit-chase', organizationId] : ['permit-chase', 'disabled'],
    queryFn: () => fetchPermitsPipeline(organizationId!),
    enabled: !!organizationId,
  });
}
