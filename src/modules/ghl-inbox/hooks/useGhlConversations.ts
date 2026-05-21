import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchGhlConversations } from '../api/ghlInbox.api';
import { ghlInboxKeys } from '../api/ghlInbox.keys';

export function useGhlConversations(enabled = true) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? ghlInboxKeys.conversations(organizationId)
      : ['ghl-inbox', 'conversations', 'disabled'],
    queryFn: () => fetchGhlConversations(organizationId!),
    enabled: !!organizationId && enabled,
  });
}
