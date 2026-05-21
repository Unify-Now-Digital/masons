import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchGhlContact } from '../api/ghlInbox.api';
import { ghlInboxKeys } from '../api/ghlInbox.keys';

export function useGhlContact(contactId: string | null) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      organizationId && contactId
        ? ghlInboxKeys.contact(organizationId, contactId)
        : ['ghl-inbox', 'contact', 'disabled'],
    queryFn: () => fetchGhlContact(organizationId!, contactId!),
    enabled: !!organizationId && !!contactId,
  });
}
