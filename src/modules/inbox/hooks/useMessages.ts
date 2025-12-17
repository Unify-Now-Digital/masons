import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchMessages, 
  fetchMessage, 
  fetchThreadMessages,
  fetchMessagesByOrder,
  fetchMessagesByCompany,
  createMessage, 
  updateMessage, 
  markMessageAsRead,
  deleteMessage 
} from '../api/inbox.api';
import type { MessageInsert, MessageUpdate } from '../types/inbox.types';

export const messagesKeys = {
  all: ['messages'] as const,
  detail: (id: string) => ['messages', id] as const,
  thread: (threadId: string) => ['messages', 'thread', threadId] as const,
  byOrder: (orderId: string) => ['messages', 'byOrder', orderId] as const,
  byCompany: (companyId: string) => ['messages', 'byCompany', companyId] as const,
};

export function useMessagesList() {
  return useQuery({
    queryKey: messagesKeys.all,
    queryFn: fetchMessages,
  });
}

export function useMessage(id: string) {
  return useQuery({
    queryKey: messagesKeys.detail(id),
    queryFn: () => fetchMessage(id),
    enabled: !!id,
  });
}

export function useThreadMessages(threadId: string) {
  return useQuery({
    queryKey: messagesKeys.thread(threadId),
    queryFn: () => fetchThreadMessages(threadId),
    enabled: !!threadId,
  });
}

/**
 * React Query hook to fetch messages by order ID
 * @param orderId - UUID of the order (hook is disabled if orderId is falsy)
 * @returns React Query result with messages array
 */
export function useMessagesByOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: messagesKeys.byOrder(orderId!),
    queryFn: () => fetchMessagesByOrder(orderId!),
    enabled: !!orderId,
  });
}

/**
 * React Query hook to fetch messages by company ID
 * @param companyId - UUID of the company (hook is disabled if companyId is falsy)
 * @returns React Query result with messages array
 */
export function useMessagesByCompany(companyId: string | null | undefined) {
  return useQuery({
    queryKey: messagesKeys.byCompany(companyId!),
    queryFn: () => fetchMessagesByCompany(companyId!),
    enabled: !!companyId,
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (message: MessageInsert) => createMessage(message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.all });
    },
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MessageUpdate }) => 
      updateMessage(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.all });
      queryClient.setQueryData(messagesKeys.detail(data.id), data);
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => markMessageAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.all });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.all });
    },
  });
}

