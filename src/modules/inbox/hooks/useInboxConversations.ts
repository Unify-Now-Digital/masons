import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  fetchConversations,
  fetchConversation,
  createConversation,
  updateConversation,
  markConversationsAsRead,
  markConversationsAsUnread,
  archiveConversations,
  deleteConversations,
  linkConversation,
  unlinkConversation,
  linkConversations,
  unlinkConversations,
} from '../api/inboxConversations.api';
import type { CreateConversationPayload } from '../api/inboxConversations.api';
import { syncGmail } from '../api/inboxGmail.api';
import type { InboxConversation, ConversationFilters } from '../types/inbox.types';
import { invalidateInboxThreadSummaries } from './useThreadSummary';

export const inboxKeys = {
  all: ['inbox'] as const,
  conversations: {
    all: ['inbox', 'conversations'] as const,
    lists: (organizationId: string, filters?: ConversationFilters) =>
      ['inbox', 'conversations', 'list', organizationId, filters] as const,
    detail: (id: string) => ['inbox', 'conversations', id] as const,
  },
  customers: {
    all: ['inbox', 'customers'] as const,
    lists: (filters?: ConversationFilters) => ['inbox', 'customers', 'list', filters] as const,
  },
  messages: {
    all: ['inbox', 'messages'] as const,
    byConversation: (id: string) => ['inbox', 'messages', 'conversation', id] as const,
    customerMessages: (personId: string, conversationIds: string[]) =>
      ['inbox', 'customerMessages', personId, conversationIds] as const,
    personTimeline: (personId: string, conversationIds: string[]) =>
      ['inbox', 'customerMessages', personId, conversationIds] as const,
    unlinkedTimeline: (channel: string, handle: string) =>
      ['inbox', 'messages', 'unlinkedTimeline', channel, handle] as const,
  },
  channels: {
    all: ['inbox', 'channels'] as const,
  },
};

function updateConversationUnreadCountInCache(
  value: unknown,
  ids: string[],
  targetUnreadCount: number
): unknown {
  if (!value) return value;

  // Case A: value is InboxConversation[]
  if (Array.isArray(value)) {
    return (value as InboxConversation[]).map((conversation) =>
      ids.includes(conversation.id)
        ? { ...conversation, unread_count: targetUnreadCount }
        : conversation
    );
  }

  if (typeof value === 'object') {
    const obj: any = value;

    // Case B: value is { data: InboxConversation[] }
    if (Array.isArray(obj.data)) {
      return {
        ...obj,
        data: (obj.data as InboxConversation[]).map((conversation) =>
          ids.includes(conversation.id)
            ? { ...conversation, unread_count: targetUnreadCount }
            : conversation
        ),
      };
    }

    // Case C: value is { pages: Array<...> } (infinite query)
    if (Array.isArray(obj.pages)) {
      return {
        ...obj,
        pages: obj.pages.map((page: unknown) =>
          updateConversationUnreadCountInCache(page, ids, targetUnreadCount)
        ),
      };
    }
  }

  // Case D: unknown shape – leave unchanged
  return value;
}

/** List refreshes via Realtime invalidation and Gmail sync invalidation; no interval polling to avoid repeated requests. */
export function useConversationsList(
  filters?: ConversationFilters,
  options?: { enabled?: boolean }
) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? inboxKeys.conversations.lists(organizationId, filters)
      : ['inbox', 'conversations', 'list', 'disabled', filters],
    queryFn: () => fetchConversations(organizationId!, filters),
    enabled: (options?.enabled ?? true) && !!organizationId,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: inboxKeys.conversations.detail(id!),
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateConversationPayload) => createConversation(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      invalidateInboxThreadSummaries(queryClient);
      queryClient.setQueryData(inboxKeys.conversations.detail(data.id), data);
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => markConversationsAsRead(ids),
    retry: 0,
    onMutate: async (ids: string[]) => {
      // Optimistically set unread_count = 0 for targeted conversations
      const previous = queryClient.getQueriesData<unknown>({ queryKey: inboxKeys.conversations.all });

      previous.forEach(([key]) => {
        queryClient.setQueryData(key, (old: unknown) =>
          updateConversationUnreadCountInCache(old, ids, 0)
        );
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      // Roll back optimistic update if something goes wrong
      if (!context?.previous) return;
      context.previous.forEach(([key, value]: [unknown, unknown]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () => {
      // Invalidate all conversation list queries to resync with server
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
    },
  });
}

export function useMarkAsUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => markConversationsAsUnread(ids),
    retry: 0,
    onMutate: async (ids: string[]) => {
      // Optimistically set unread_count = 1 for targeted conversations
      const previous = queryClient.getQueriesData<unknown>({ queryKey: inboxKeys.conversations.all });

      previous.forEach(([key]) => {
        queryClient.setQueryData(key, (old: unknown) =>
          updateConversationUnreadCountInCache(old, ids, 1)
        );
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      // Roll back optimistic update if something goes wrong
      if (!context?.previous) return;
      context.previous.forEach(([key, value]: [unknown, unknown]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () => {
      // Invalidate all conversation list queries to resync with server
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}

export function useArchiveConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => archiveConversations(ids),
    onSuccess: () => {
      // Invalidate all conversation list queries
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}

export function useDeleteConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => deleteConversations(ids),
    onSuccess: (_data, ids) => {
      // Invalidate lists and remove any now-stale detail/message caches.
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      ids.forEach((id) => {
        queryClient.removeQueries({ queryKey: inboxKeys.conversations.detail(id) });
        queryClient.removeQueries({ queryKey: inboxKeys.messages.byConversation(id) });
      });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}

export function useSyncGmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options?: { since?: string; maxMessages?: number }) => syncGmail(options),
    onSuccess: () => {
      // Invalidate all conversation list queries to show new emails
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      // Invalidate message queries so the open conversation thread refetches
      queryClient.invalidateQueries({ queryKey: inboxKeys.messages.all });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}

export function useLinkConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, personId }: { conversationId: string; personId: string }) =>
      linkConversation(conversationId, personId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.detail(variables.conversationId) });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}

export function useUnlinkConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => unlinkConversation(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.detail(conversationId) });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}

export function useLinkConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationIds, personId }: { conversationIds: string[]; personId: string }) =>
      linkConversations(conversationIds, personId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      variables.conversationIds.forEach((id) => {
        queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.detail(id) });
      });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}

export function useUnlinkConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationIds: string[]) => unlinkConversations(conversationIds),
    onSuccess: (_, conversationIds) => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      conversationIds.forEach((id) => {
        queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.detail(id) });
      });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}
