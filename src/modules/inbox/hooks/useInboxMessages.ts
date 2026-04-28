import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { supabase } from '@/shared/lib/supabase';
import { fetchMessagesByConversation, createMessage } from '../api/inboxMessages.api';
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
    staleTime: 30_000,
  });
}

/** Unified timeline for a person: all messages from all channels, chronological. */
export function usePersonUnifiedTimeline(personId: string | null): {
  messages: InboxMessage[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
} {
  const { organizationId } = useOrganization();
  const {
    data: messages = [],
    isLoading: messagesLoading,
    isFetching: messagesFetching,
    isError: messagesError,
  } = useQuery({
    queryKey: inboxKeys.messages.customerMessages(personId ?? '', organizationId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_customer_messages', {
        p_person_id: personId!,
        p_organization_id: organizationId!,
      });
      if (error) throw error;
      return (data ?? []) as InboxMessage[];
    },
    enabled: !!personId && !!organizationId,
    staleTime: 30_000,
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
    isLoading: !!personId && !!organizationId && messagesLoading,
    isFetching: !!personId && !!organizationId && (messagesLoading || messagesFetching),
    isError: messagesError,
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
  const { organizationId } = useOrganization();
  const enabled = !!channel && trimmed.length > 0 && !!organizationId;

  const {
    data: messages = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: inboxKeys.messages.unlinkedTimeline(organizationId ?? '', channel ?? '', trimmed),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_unlinked_messages', {
        p_channel: channel!,
        p_handle: trimmed,
        p_organization_id: organizationId!,
      });
      if (error) throw error;
      return (data ?? []) as InboxMessage[];
    },
    enabled,
    staleTime: 30_000,
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
    isLoading: enabled && isLoading,
    isError,
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

export function buildConversationIdByChannelFromMessages(
  messages: InboxMessage[]
): ConversationIdByChannel {
  const byChannel: ConversationIdByChannel = { email: null, sms: null, whatsapp: null };
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
