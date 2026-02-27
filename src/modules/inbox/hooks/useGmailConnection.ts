import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchActiveGmailConnection,
  getGmailOAuthUrl,
  disconnectGmail,
} from '../api/gmailConnections.api';
import { inboxKeys } from './useInboxConversations';

export const gmailConnectionKeys = {
  active: ['inbox', 'gmail-connection'] as const,
};

export function useGmailConnection() {
  return useQuery({
    queryKey: gmailConnectionKeys.active,
    queryFn: fetchActiveGmailConnection,
  });
}

export function useGmailConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const url = await getGmailOAuthUrl();
      window.location.href = url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailConnectionKeys.active });
    },
  });
}

export function useGmailDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectGmail,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailConnectionKeys.active });
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'messages'] });
    },
  });
}
