import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  disconnectGhlConnection,
  fetchGhlConnection,
  type GhlConnectionRow,
} from '../api/ghlInbox.api';
import { ghlInboxKeys } from '../api/ghlInbox.keys';

export function useGhlConnection() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? ghlInboxKeys.connection(organizationId)
      : ['ghl-inbox', 'connection', 'disabled'],
    queryFn: () => fetchGhlConnection(organizationId!),
    enabled: !!organizationId,
  });
}

export function useDisconnectGhlConnection() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (connection: GhlConnectionRow) => disconnectGhlConnection(connection.id),
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ghlInboxKeys.connection(organizationId) });
        queryClient.invalidateQueries({ queryKey: ghlInboxKeys.conversations(organizationId) });
      }
    },
  });
}
