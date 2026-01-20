import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchConversations,
  fetchConversation,
  updateConversation,
  markConversationsAsRead,
  archiveConversations,
} from '../api/inboxConversations.api';
import type { ConversationFilters } from '../types/inbox.types';

export const inboxKeys = {
  conversations: {
    all: ['inbox', 'conversations'] as const,
    lists: (filters?: ConversationFilters) => ['inbox', 'conversations', 'list', filters] as const,
    detail: (id: string) => ['inbox', 'conversations', id] as const,
  },
  messages: {
    byConversation: (id: string) => ['inbox', 'messages', 'conversation', id] as const,
  },
  channels: {
    all: ['inbox', 'channels'] as const,
  },
};

export function useConversationsList(filters?: ConversationFilters) {
  return useQuery({
    queryKey: inboxKeys.conversations.lists(filters),
    queryFn: () => fetchConversations(filters),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: inboxKeys.conversations.detail(id!),
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => markConversationsAsRead(ids),
    onSuccess: () => {
      // Invalidate all conversation list queries
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
    },
  });
}

export function useArchiveConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => archiveConversations(ids),
    onSuccess: () => {
      // Invalidate all conversation list queries
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
    },
  });
}
