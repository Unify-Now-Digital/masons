import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchConnectedWhatsAppConnection,
  fetchManagedWhatsAppStatus,
  fetchPreferredWhatsAppMode,
  connectWhatsApp,
  disconnectWhatsApp,
  setPreferredWhatsAppMode,
  startManagedWhatsAppOnboarding,
  submitManagedWhatsAppBusiness,
  testWhatsAppConnection,
  type ConnectWhatsAppParams,
  type ManagedSubmitBusinessParams,
  type PreferredWhatsAppMode,
} from '../api/whatsappConnections.api';
import { inboxKeys } from './useInboxConversations';
import { invalidateInboxThreadSummaries } from './useThreadSummary';

export const whatsappConnectionKeys = {
  connection: ['inbox', 'whatsapp-connection'] as const,
  preferredMode: ['inbox', 'whatsapp-preferred-mode'] as const,
  managedStatus: ['inbox', 'whatsapp-managed-status'] as const,
};

/** Uses the connected row (status = 'connected') for current status and actions. */
export function useWhatsAppConnection() {
  return useQuery({
    queryKey: whatsappConnectionKeys.connection,
    queryFn: fetchConnectedWhatsAppConnection,
  });
}

export function usePreferredWhatsAppMode() {
  return useQuery({
    queryKey: whatsappConnectionKeys.preferredMode,
    queryFn: fetchPreferredWhatsAppMode,
  });
}

export function useSetPreferredWhatsAppMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: PreferredWhatsAppMode) => setPreferredWhatsAppMode(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.preferredMode });
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.managedStatus });
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.connection });
    },
  });
}

export function useManagedWhatsAppStatus() {
  return useQuery({
    queryKey: whatsappConnectionKeys.managedStatus,
    queryFn: fetchManagedWhatsAppStatus,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 15000;
      return ['pending_provider_review', 'pending_meta_action', 'provisioning', 'action_required'].includes(status)
        ? 10000
        : false;
    },
  });
}

export function useManagedWhatsAppStart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startManagedWhatsAppOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.managedStatus });
    },
  });
}

export function useManagedWhatsAppSubmitBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ManagedSubmitBusinessParams) => submitManagedWhatsAppBusiness(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.managedStatus });
    },
  });
}

export function useWhatsAppConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ConnectWhatsAppParams) => connectWhatsApp(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.connection });
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.managedStatus });
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
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.managedStatus });
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
