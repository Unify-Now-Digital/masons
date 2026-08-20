import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchJobsByPersonId } from '../api/jobsPipeline.api';
import { jobsPipelineKeys } from '../api/jobsPipelineKeys';

/** All jobs linked to a person (newest first). Org-guarded + RLS-scoped. */
export function useJobsByPersonId(personId: string | null) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: jobsPipelineKeys.personJobs(organizationId, personId ?? ''),
    queryFn: () => fetchJobsByPersonId(personId!, organizationId!),
    enabled: !!personId && !!organizationId,
  });
}
