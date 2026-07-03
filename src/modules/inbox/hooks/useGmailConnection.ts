import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  fetchOrgGmailConnection,
  getGmailOAuthUrl,
  disconnectGmail,
} from '../api/gmailConnections.api';
import { inboxKeys } from './useInboxConversations';
import { invalidateInboxThreadSummaries } from './useThreadSummary';

export const gmailConnectionKeys = {
  all: ['inbox', 'gmail-connection'] as const,
  active: (organizationId: string | null) =>
    ['inbox', 'gmail-connection', organizationId] as const,
};

/**
 * The org's Gmail connection — active row when one exists, else the latest revoked row (for the
 * "reconnect required" indicator). Check `status === 'active'` before treating it as usable.
 */
export function useGmailConnection() {
  const { organizationId } = useOrganization();
  return useQuery({
    // Org id in the key so switching orgs can't serve another org's cached connection
    queryKey: gmailConnectionKeys.active(organizationId),
    queryFn: () => fetchOrgGmailConnection(organizationId!),
    enabled: !!organizationId,
  });
}

export function useGmailConnect() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: async () => {
      if (!organizationId) {
        throw new Error('No active organization selected');
      }
      const url = await getGmailOAuthUrl(organizationId);
      window.location.href = url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailConnectionKeys.all });
    },
  });
}

export function useGmailDisconnect() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: async () => {
      if (!organizationId) {
        throw new Error('No active organization selected');
      }
      await disconnectGmail(organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailConnectionKeys.all });
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'messages'] });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}
