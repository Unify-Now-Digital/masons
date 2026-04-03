import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchMessagesByConversation, fetchMessagesByConversationIds, createMessage } from '../api/inboxMessages.api';
import { fetchConversations } from '../api/inboxConversations.api';
import { inboxKeys } from './useInboxConversations';
import { sendTwilioMessage } from '../api/inboxTwilio.api';
import { sendGmailReply, sendGmailFirstMessage } from '../api/inboxGmail.api';
import { sendSmsReply } from '../api/inboxSms.api';
import type { InboxMessage } from '../types/inbox.types';

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
    queryKey: inboxKeys.messages.personTimeline(personId ?? '', conversationIds),
    queryFn: () => fetchMessagesByConversationIds(conversationIds),
    enabled: !!personId && conversationIds.length > 0,
  });
  return {
    messages,
    isLoading: conversationsLoading || (!!personId && conversationIds.length > 0 && messagesLoading),
    isError: conversationsError || messagesError,
  };
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
    }: {
      conversationId: string;
      bodyText: string;
      channel: 'email' | 'sms' | 'whatsapp';
      isFirstEmailMessage?: boolean;
      subject?: string | null;
    }) => {
      const trimmedBodyText = bodyText.trim();
      if (!trimmedBodyText) {
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
      return await sendTwilioMessage({
        conversation_id: conversationId,
        body_text: trimmedBodyText,
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate message thread
      queryClient.invalidateQueries({ queryKey: inboxKeys.messages.byConversation(variables.conversationId) });
      // Invalidate conversation list (to update last_message_*)
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
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
