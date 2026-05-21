import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchGhlMessages } from '../api/ghlInbox.api';
import { ghlInboxKeys } from '../api/ghlInbox.keys';

export function useGhlMessages(conversationId: string | null) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      organizationId && conversationId
        ? ghlInboxKeys.messages(organizationId, conversationId)
        : ['ghl-inbox', 'messages', 'disabled'],
    queryFn: () => fetchGhlMessages(organizationId!, conversationId!),
    enabled: !!organizationId && !!conversationId,
  });
}
