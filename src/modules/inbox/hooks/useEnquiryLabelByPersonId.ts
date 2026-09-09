import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { EnquiryLabelSource } from '@/modules/inbox/utils/inquiryRowLabel';

export const enquiryLabelKeys = {
  all: ['enquiry-label-by-person'] as const,
  list: (organizationId: string) => ['enquiry-label-by-person', 'list', organizationId] as const,
};

type EnquiryRow = EnquiryLabelSource & { person_id: string; created_at: string };

async function fetchLatestEnquiryByPersonId(
  organizationId: string
): Promise<Map<string, EnquiryLabelSource>> {
  const { data, error } = await supabase
    .from('enquiries')
    .select('person_id, channel, sub_type, source_page, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const map = new Map<string, EnquiryLabelSource>();
  for (const row of (data ?? []) as EnquiryRow[]) {
    if (!row.person_id || map.has(row.person_id)) continue;
    map.set(row.person_id, {
      channel: row.channel,
      sub_type: row.sub_type,
      source_page: row.source_page,
    });
  }
  return map;
}

export function useEnquiryLabelByPersonId() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? enquiryLabelKeys.list(organizationId)
      : ['enquiry-label-by-person', 'list', 'disabled'],
    queryFn: () => fetchLatestEnquiryByPersonId(organizationId!),
    enabled: !!organizationId,
  });
}
