import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useTestDataMode } from '@/shared/context/TestDataContext';
import { fetchLogistics } from '../api/logistics.api';

export function useLogistics() {
  const { organizationId } = useOrganization();
  const { showTestData } = useTestDataMode();
  const excludeTest = !showTestData;
  return useQuery({
    queryKey: organizationId
      ? ['logistics', organizationId, { excludeTest }]
      : ['logistics', 'disabled'],
    queryFn: () => fetchLogistics(organizationId!, { excludeTest }),
    enabled: !!organizationId,
  });
}
