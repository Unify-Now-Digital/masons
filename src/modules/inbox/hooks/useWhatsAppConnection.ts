import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchConnectedWhatsAppConnection,
  connectWhatsApp,
  disconnectWhatsApp,
  testWhatsAppConnection,
  type ConnectWhatsAppParams,
} from '../api/whatsappConnections.api';
import { inboxKeys } from './useInboxConversations';
import { invalidateInboxThreadSummaries } from './useThreadSummary';

export const whatsappConnectionKeys = {
  connection: ['inbox', 'whatsapp-connection'] as const,
};

/** Uses the connected row (status = 'connected') for current status and actions. */
export function useWhatsAppConnection() {
  return useQuery({
    queryKey: whatsappConnectionKeys.connection,
    queryFn: fetchConnectedWhatsAppConnection,
  });
}

export function useWhatsAppConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ConnectWhatsAppParams) => connectWhatsApp(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.connection });
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}

export function useWhatsAppDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectWhatsApp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.connection });
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
      queryClient.invalidateQueries({ queryKey: ['inbox', 'messages'] });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}

export function useWhatsAppTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: testWhatsAppConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.connection });
    },
  });
}
