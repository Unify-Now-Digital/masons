import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchPriorityQueue } from '../api/priority.api';

export function usePriorityQueue() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['priority', organizationId] : ['priority', 'disabled'],
    queryFn: () => fetchPriorityQueue(organizationId!),
    enabled: !!organizationId,
  });
}
