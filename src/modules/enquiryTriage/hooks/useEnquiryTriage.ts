import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchEnquiries } from '../api/enquiryTriage.api';

export function useEnquiries() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? ['enquiry-triage', organizationId] : ['enquiry-triage', 'disabled'],
    queryFn: () => fetchEnquiries(organizationId!),
    enabled: !!organizationId,
  });
}
