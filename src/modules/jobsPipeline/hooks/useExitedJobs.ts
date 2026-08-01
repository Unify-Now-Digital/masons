import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchExitedJobs } from '../api/jobsPipeline.api';
import { jobsPipelineKeys } from '../api/jobsPipelineKeys';

export function useExitedJobs() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: jobsPipelineKeys.exited(organizationId),
    queryFn: () => fetchExitedJobs(organizationId!),
    enabled: !!organizationId,
  });
}
