import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchEnquiryPipeline } from '../api/enquiryPipeline.api';
import type { ConversationFilters } from '../types/inbox.types';

export const enquiryPipelineKeys = {
  all: ['inbox', 'enquiryPipeline'] as const,
  list: (organizationId: string, channel?: ConversationFilters['channel']) =>
    ['inbox', 'enquiryPipeline', organizationId, channel ?? 'all'] as const,
};

export function useEnquiryPipeline(
  filters?: Pick<ConversationFilters, 'channel'>,
  options?: { enabled?: boolean },
) {
  const { organizationId } = useOrganization();

  return useQuery({
    queryKey: enquiryPipelineKeys.list(organizationId ?? '', filters?.channel),
    queryFn: () => fetchEnquiryPipeline(organizationId!, filters),
    enabled: (options?.enabled ?? true) && !!organizationId,
  });
}
