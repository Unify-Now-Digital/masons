import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { supabase } from '@/shared/lib/supabase';
import { fetchMessagesByConversation, fetchMessagesByConversationIds, createMessage } from '../api/inboxMessages.api';
import { inboxKeys } from './useInboxConversations';
import { invalidateInboxThreadSummaries } from './useThreadSummary';
import { sendTwilioMessage } from '../api/inboxTwilio.api';
import { sendGmailReply, sendGmailFirstMessage } from '../api/inboxGmail.api';
import { sendSmsReply } from '../api/inboxSms.api';
import type { ConversationIdByChannel, InboxChannel, InboxConversation, InboxMessage } from '../types/inbox.types';

function sortInboxMessages(messages: InboxMessage[]): InboxMessage[] {
  if (!messages.length) return [];
  const byId = new Map<string, InboxMessage>();
  messages.forEach((message) => {
    byId.set(message.id, message);
  });
  return Array.from(byId.values()).sort((a, b) => {
    const aSent = new Date(a.sent_at ?? a.created_at).getTime();
    const bSent = new Date(b.sent_at ?? b.created_at).getTime();
    if (aSent !== bSent) return aSent - bSent;
    const aCreated = new Date(a.created_at).getTime();
    const bCreated = new Date(b.created_at).getTime();
    if (aCreated !== bCreated) return aCreated - bCreated;
    return a.id.localeCompare(b.id);
  });
}

/** Thread messages refresh via Realtime invalidation (UnifiedInboxPage invalidates byConversation on INSERT/UPDATE); no interval polling. */
export function useMessagesByConversation(conversationId: string | null) {
  const query = useQuery({
    queryKey: inboxKeys.messages.byConversation(conversationId!),
    queryFn: ({ queryKey }) => fetchMessagesByConversation(String(queryKey[3])),
    enabled: !!conversationId,
    staleTime: 30_000,
  });
  return {
    ...query,
    // Drop a payload that belongs to a conversation we are no longer showing.
    data: query.isSuccess ? query.data : undefined,
    loadedConversationId: query.isSuccess ? conversationId : null,
  };
}

/** Unified timeline for a person: all messages from all channels, chronological. */
export function usePersonUnifiedTimeline(personId: string | null): {
  messages: InboxMessage[];
  /** Person id the messages were loaded for. Null while a fetch for someone else is in flight. */
  loadedKey: string | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const { organizationId } = useOrganization();
  const query = useQuery({
    queryKey: inboxKeys.messages.customerMessages(personId ?? '', organizationId ?? ''),
    queryFn: async ({ queryKey }) => {
      const keyPersonId = String(queryKey[2]);
      const keyOrgId = String(queryKey[3]);
      const { data, error } = await supabase.rpc('get_customer_messages', {
        p_person_id: keyPersonId,
        p_organization_id: keyOrgId,
      });
      if (error) throw error;
      return (data ?? []) as InboxMessage[];
    },
    enabled: !!personId && !!organizationId,
    staleTime: 30_000,
    retry: 2,
  });
  const sortedMessages = useMemo(() => sortInboxMessages(query.data ?? []), [query.data]);
  const ready = query.isSuccess && !!personId;
  return {
    messages: ready ? sortedMessages : [],
    loadedKey: ready ? personId : null,
    isLoading: !!personId && !!organizationId && query.isPending,
    isFetching: !!personId && !!organizationId && query.isFetching,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

/** Semantic alias for customer-centric mode. */
export function useCustomerMessages(personId: string | null) {
  return usePersonUnifiedTimeline(personId);
}

/** Open unlinked conversations for one exact handle + channel; unified message timeline (chronological). */
export function useUnlinkedHandleTimeline(
  channel: InboxChannel | null,
  handle: string | null
): {
  messages: InboxMessage[];
  loadedKey: string | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const trimmed = handle?.trim() ?? '';
  const { organizationId } = useOrganization();
  const enabled = !!channel && trimmed.length > 0 && !!organizationId;
  const selectionKey = channel && trimmed ? `${channel}:${trimmed}` : null;

  const query = useQuery({
    queryKey: inboxKeys.messages.unlinkedTimeline(organizationId ?? '', channel ?? '', trimmed),
    queryFn: async ({ queryKey }) => {
      const keyOrgId = String(queryKey[3]);
      const keyChannel = String(queryKey[4]);
      const keyHandle = String(queryKey[5]);
      const { data, error } = await supabase.rpc('get_unlinked_messages', {
        p_channel: keyChannel,
        p_handle: keyHandle,
        p_organization_id: keyOrgId,
      });
      if (error) throw error;
      return (data ?? []) as InboxMessage[];
    },
    enabled,
    staleTime: 30_000,
  });

  const sortedMessages = useMemo(() => sortInboxMessages(query.data ?? []), [query.data]);
  const ready = query.isSuccess && !!selectionKey;

  return {
    messages: ready ? sortedMessages : [],
    loadedKey: ready ? selectionKey : null,
    isLoading: enabled && query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

/**
 * Unified timeline for an unlinked GROUP: messages across the group's conversation
 * ids (may span channels and handle spellings that normalize to one groupKey).
 * Fixes the cross-channel gap where a handle+channel fetch only surfaced the
 * most-recent thread's subset. Org scoping is enforced by RLS on inbox_messages.
 */
export function useUnlinkedGroupTimeline(conversationIds: string[] | null): {
  messages: InboxMessage[];
  loadedKey: string | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const { organizationId } = useOrganization();
  const ids = useMemo(() => conversationIds ?? [], [conversationIds]);
  const enabled = ids.length > 0 && !!organizationId;
  const selectionKey = ids.length > 0 ? [...ids].sort().join(',') : null;

  const query = useQuery({
    queryKey: inboxKeys.messages.unlinkedGroupTimeline(organizationId ?? '', ids),
    queryFn: ({ queryKey }) => {
      const joined = String(queryKey[4] ?? '');
      const keyIds = joined ? joined.split(',') : [];
      return fetchMessagesByConversationIds(keyIds);
    },
    enabled,
    staleTime: 30_000,
  });

  const sortedMessages = useMemo(() => sortInboxMessages(query.data ?? []), [query.data]);
  const ready = query.isSuccess && !!selectionKey;

  return {
    messages: ready ? sortedMessages : [],
    loadedKey: ready ? selectionKey : null,
    isLoading: enabled && query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

const CHANNEL_PRIORITY: InboxChannel[] = ['email', 'sms', 'whatsapp', 'web'];

/**
 * Resolve latest conversation id per channel.
 * Prefers channels that have the most recent messages; falls back to conversation recency.
 */
export function buildConversationIdByChannel(
  conversations: InboxConversation[],
  messages: InboxMessage[]
): ConversationIdByChannel {
  const byChannel: ConversationIdByChannel = { email: null, sms: null, whatsapp: null, web: null };
  const latestMessageTsByConversation = new Map<string, number>();
  messages.forEach((message) => {
    const ts = new Date(message.sent_at ?? message.created_at).getTime();
    const prev = latestMessageTsByConversation.get(message.conversation_id) ?? Number.NEGATIVE_INFINITY;
    if (ts > prev) latestMessageTsByConversation.set(message.conversation_id, ts);
  });

  CHANNEL_PRIORITY.forEach((channel) => {
    const candidates = conversations.filter((conversation) => conversation.channel === channel);
    if (candidates.length === 0) return;
    const fromMessages = candidates
      .map((conversation) => ({
        id: conversation.id,
        ts: latestMessageTsByConversation.get(conversation.id) ?? Number.NEGATIVE_INFINITY,
      }))
      .sort((a, b) => b.ts - a.ts);
    if (fromMessages.length > 0 && Number.isFinite(fromMessages[0].ts)) {
      byChannel[channel] = fromMessages[0].id;
      return;
    }
    const fromConversation = candidates
      .slice()
      .sort((a, b) => {
        const aTs = new Date(a.last_message_at ?? a.created_at).getTime();
        const bTs = new Date(b.last_message_at ?? b.created_at).getTime();
        return bTs - aTs;
      })[0];
    byChannel[channel] = fromConversation?.id ?? null;
  });

  return byChannel;
}

export function buildConversationIdByChannelFromMessages(
  messages: InboxMessage[]
): ConversationIdByChannel {
  const byChannel: ConversationIdByChannel = { email: null, sms: null, whatsapp: null, web: null };
  const latestByChannel = new Map<InboxChannel, { conversationId: string; ts: number }>();

  messages.forEach((message) => {
    const ts = new Date(message.sent_at ?? message.created_at).getTime();
    const prev = latestByChannel.get(message.channel);
    if (!prev || ts > prev.ts) {
      latestByChannel.set(message.channel, { conversationId: message.conversation_id, ts });
    }
  });

  CHANNEL_PRIORITY.forEach((channel) => {
    byChannel[channel] = latestByChannel.get(channel)?.conversationId ?? null;
  });

  return byChannel;
}

export function useSendReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      bodyText,
      channel,
      isFirstEmailMessage,
      subject,
      whatsappTemplate,
    }: {
      conversationId: string;
      bodyText: string;
      channel: 'email' | 'sms' | 'whatsapp';
      isFirstEmailMessage?: boolean;
      subject?: string | null;
      whatsappTemplate?: {
        contentSid: string;
        contentVariables: Record<string, string>;
      };
    }) => {
      const trimmedBodyText = bodyText.trim();
      if (!trimmedBodyText && channel !== 'whatsapp') {
        throw new Error('Message body cannot be empty');
      }

      if (channel === 'email') {
        if (isFirstEmailMessage) {
          return await sendGmailFirstMessage({
            conversationId,
            bodyText: trimmedBodyText,
            subject: subject ?? undefined,
          });
        }
        return await sendGmailReply({
          conversationId,
          bodyText: trimmedBodyText,
          subject: subject ?? undefined,
        });
      }
      if (channel === 'sms') {
        return await sendSmsReply({
          conversationId,
          bodyText: trimmedBodyText,
        });
      }
      // WhatsApp via inbox-twilio-send
      if (whatsappTemplate) {
        return await sendTwilioMessage({
          conversation_id: conversationId,
          body_text: trimmedBodyText,
          contentSid: whatsappTemplate.contentSid,
          contentVariables: whatsappTemplate.contentVariables,
        });
      }
      return await sendTwilioMessage({
        conversation_id: conversationId,
        body_text: trimmedBodyText,
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate message thread
      queryClient.invalidateQueries({ queryKey: inboxKeys.messages.byConversation(variables.conversationId) });
      // Invalidate all inbox query families so both modes update immediately.
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      invalidateInboxThreadSummaries(queryClient);
      // Invalidate conversation detail
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.detail(variables.conversationId) });
    },
  });
}

/** Save an internal note (not sent externally). Inserts directly into inbox_messages. */
export function useSaveInternalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      bodyText,
      channel,
    }: {
      conversationId: string;
      bodyText: string;
      channel: 'email' | 'sms' | 'whatsapp';
    }) => {
      const trimmed = bodyText.trim();
      if (!trimmed) throw new Error('Note cannot be empty');

      return await createMessage({
        conversation_id: conversationId,
        channel,
        direction: 'outbound',
        from_handle: 'Internal note',
        to_handle: '',
        body_text: trimmed,
        subject: null,
        sent_at: new Date().toISOString(),
        status: 'sent',
        message_type: 'internal_note',
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.messages.byConversation(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.detail(variables.conversationId) });
    },
  });
}
