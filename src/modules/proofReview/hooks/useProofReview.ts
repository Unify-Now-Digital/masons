import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchProofPayload } from '../api/proofReview.api';

export function useProofPayload() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['proof-review', organizationId] : ['proof-review', 'disabled'],
    queryFn: () => fetchProofPayload(organizationId!),
    enabled: !!organizationId,
  });
}
