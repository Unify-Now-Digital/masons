import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchMessagesByConversation, fetchMessagesByConversationIds } from '../api/inboxMessages.api';
import { fetchConversations } from '../api/inboxConversations.api';
import { inboxKeys } from './useInboxConversations';
import { invalidateInboxThreadSummaries } from './useThreadSummary';
import { sendTwilioMessage } from '../api/inboxTwilio.api';
import { sendGmailReply, sendGmailFirstMessage } from '../api/inboxGmail.api';
import { sendSmsReply } from '../api/inboxSms.api';
import type { ConversationIdByChannel, InboxChannel, InboxConversation, InboxMessage } from '../types/inbox.types';

/** Thread messages refresh via Realtime invalidation (UnifiedInboxPage invalidates byConversation on INSERT/UPDATE); no interval polling. */
export function useMessagesByConversation(conversationId: string | null) {
  return useQuery({
    queryKey: inboxKeys.messages.byConversation(conversationId!),
    queryFn: () => fetchMessagesByConversation(conversationId!),
    enabled: !!conversationId,
  });
}

/** Unified timeline for a person: all messages from all channels, chronological. */
export function usePersonUnifiedTimeline(personId: string | null): {
  messages: InboxMessage[];
  isLoading: boolean;
  isError: boolean;
} {
  const filters = useMemo(
    () => (personId ? { status: 'open' as const, person_id: personId } : null),
    [personId]
  );
  const { data: conversations = [], isLoading: conversationsLoading, isError: conversationsError } = useQuery({
    queryKey: inboxKeys.conversations.lists(filters ?? undefined),
    queryFn: () => fetchConversations(filters!),
    enabled: !!personId && !!filters,
  });
  const conversationIds = useMemo(
    () => (conversations?.map((c) => c.id) ?? []).slice().sort(),
    [conversations]
  );
  const {
    data: messages = [],
    isLoading: messagesLoading,
    isError: messagesError,
  } = useQuery({
    queryKey: inboxKeys.messages.customerMessages(personId ?? '', conversationIds),
    queryFn: () => fetchMessagesByConversationIds(conversationIds),
    enabled: !!personId && conversationIds.length > 0,
  });
  const sortedMessages = useMemo(() => {
    if (!messages?.length) return [];
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
  }, [messages]);
  return {
    messages: sortedMessages,
    isLoading: conversationsLoading || (!!personId && conversationIds.length > 0 && messagesLoading),
    isError: conversationsError || messagesError,
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
  isLoading: boolean;
  isError: boolean;
} {
  const trimmed = handle?.trim() ?? '';
  const enabled = !!channel && trimmed.length > 0;

  const { data: conversations = [], isLoading: convLoading, isError: convError } = useQuery({
    queryKey: inboxKeys.messages.unlinkedTimeline(channel ?? '', trimmed),
    queryFn: () =>
      fetchConversations({
        status: 'open',
        unlinked_only: true,
        channel: channel!,
        primary_handle_exact: trimmed,
      }),
    enabled,
  });

  const conversationIds = useMemo(
    () => (conversations?.map((c) => c.id) ?? []).slice().sort(),
    [conversations]
  );

  const {
    data: messages = [],
    isLoading: messagesLoading,
    isError: messagesError,
  } = useQuery({
    queryKey: [...inboxKeys.messages.unlinkedTimeline(channel ?? '', trimmed), 'msgs', conversationIds] as const,
    queryFn: () => fetchMessagesByConversationIds(conversationIds),
    enabled: enabled && conversationIds.length > 0,
  });

  const sortedMessages = useMemo(() => {
    if (!messages?.length) return [];
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
  }, [messages]);

  return {
    messages: sortedMessages,
    isLoading: convLoading || (enabled && conversationIds.length > 0 && messagesLoading),
    isError: convError || messagesError,
  };
}

const CHANNEL_PRIORITY: InboxChannel[] = ['email', 'sms', 'whatsapp'];

/**
 * Resolve latest conversation id per channel.
 * Prefers channels that have the most recent messages; falls back to conversation recency.
 */
export function buildConversationIdByChannel(
  conversations: InboxConversation[],
  messages: InboxMessage[]
): ConversationIdByChannel {
  const byChannel: ConversationIdByChannel = { email: null, sms: null, whatsapp: null };
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
