import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchDueDormantCount, fetchExitedJobs } from '../api/jobsPipeline.api';
import { jobsPipelineKeys } from '../api/jobsPipelineKeys';

export function useExitedJobs() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: jobsPipelineKeys.exited(organizationId),
    queryFn: () => fetchExitedJobs(organizationId!),
    enabled: !!organizationId,
  });
}

/** Dormant jobs past their wake date — drives the "(n due)" hint on the Exited toggle. */
export function useDueDormantCount() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: jobsPipelineKeys.dueDormantCount(organizationId),
    queryFn: () => fetchDueDormantCount(organizationId!),
    enabled: !!organizationId,
  });
}
