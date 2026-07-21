import { useMemo } from 'react';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { useConversationsList } from './useInboxConversations';
import { conversationGroupKey } from '../utils/conversationGroupKey';
import type {
  ConversationFilters,
  ConversationIdByChannel,
  CustomerThreadRollups,
  CustomerThreadRow,
  InboxChannel,
  InboxConversation,
} from '../types/inbox.types';

interface UseCustomerThreadsParams {
  baseFilters: ConversationFilters;
  channelFilter: 'all' | InboxChannel;
  listFilter: 'all' | 'unread' | 'urgent' | 'unlinked';
}

function isUrgent(conversation: InboxConversation): boolean {
  return /urgent/i.test(conversation.subject ?? '') || /urgent/i.test(conversation.last_message_preview ?? '');
}

function toTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function sortByRecent(group: InboxConversation[]): InboxConversation[] {
  return group.slice().sort((a, b) => {
    const aTs = new Date(a.last_message_at ?? a.created_at).getTime();
    const bTs = new Date(b.last_message_at ?? b.created_at).getTime();
    return bTs - aTs;
  });
}

function computeRollups(groupKey: string, group: InboxConversation[], latest: InboxConversation): CustomerThreadRollups {
  let oldestAwaitingReplyAt: string | null = null;
  let oldestAwaitingReplyTs: number | null = null;
  group.forEach((c) => {
    const inbound = toTime(c.last_inbound_at);
    if (inbound == null) return;
    const outbound = toTime(c.last_outbound_at);
    // Awaiting reply: last inbound is newer than the last outbound (or no outbound yet).
    if (outbound != null && inbound <= outbound) return;
    if (oldestAwaitingReplyTs == null || inbound < oldestAwaitingReplyTs) {
      oldestAwaitingReplyTs = inbound;
      oldestAwaitingReplyAt = c.last_inbound_at ?? null;
    }
  });

  return {
    groupKey,
    conversationCount: group.length,
    oldestAwaitingReplyAt,
    anyAwaitingReply: oldestAwaitingReplyAt !== null,
    displayHandle: latest.primary_handle,
    latestSubject: latest.subject ?? null,
  };
}

export function useCustomerThreads({ baseFilters, channelFilter, listFilter }: UseCustomerThreadsParams) {
  const { data: conversations = [], isLoading, isError } = useConversationsList(baseFilters);
  const { data: customers = [] } = useCustomersList();

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((customer) => {
      const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
      map.set(customer.id, fullName || customer.email || customer.phone || '—');
    });
    return map;
  }, [customers]);

  const rows = useMemo<CustomerThreadRow[]>(() => {
    // Groups keyed by conversationGroupKey: 'p:<person_id>' for linked rows,
    // 'h:<normalized handle>' for unlinked rows (merged ACROSS channels),
    // 'c:<conversation id>' for degenerate handles that group alone.
    const groups = new Map<string, InboxConversation[]>();

    conversations.forEach((conversation) => {
      if (listFilter === 'urgent' && !isUrgent(conversation)) return;
      // Preserve pre-grouping behaviour: unlinked rows with an empty handle never render.
      if (!conversation.person_id && !(conversation.primary_handle ?? '').trim()) return;

      const key = conversationGroupKey(conversation);
      const list = groups.get(key) ?? [];
      list.push(conversation);
      groups.set(key, list);
    });

    const linkedRows: CustomerThreadRow[] = [];
    const unlinkedRows: CustomerThreadRow[] = [];

    groups.forEach((group, key) => {
      const sortedByRecent = sortByRecent(group);
      const latest = sortedByRecent[0];
      const latestByChannel: ConversationIdByChannel = {
        email: null,
        sms: null,
        whatsapp: null,
      };
      sortedByRecent.forEach((c) => {
        if (!latestByChannel[c.channel]) latestByChannel[c.channel] = c.id;
      });
      const channels = (['email', 'sms', 'whatsapp'] as const).filter((ch) => !!latestByChannel[ch]);
      if (channelFilter !== 'all' && !channels.includes(channelFilter)) return;

      const unreadCount = group.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);
      const rollups = computeRollups(key, group, latest);

      if (key.startsWith('p:')) {
        if (listFilter === 'unlinked') return;
        const personId = key.slice(2);
        linkedRows.push({
          ...rollups,
          kind: 'linked',
          personId,
          displayName: customerNameById.get(personId) ?? latest.primary_handle,
          latestMessageAt: latest.last_message_at ?? latest.created_at,
          latestPreview: latest.last_message_preview ?? latest.subject ?? null,
          unreadCount,
          hasUnread: unreadCount > 0,
          channels: [...channels],
          latestConversationIdByChannel: latestByChannel,
          latestConversationId: latest.id,
          conversationIds: group.map((c) => c.id),
        });
        return;
      }

      const handle = latest.primary_handle.trim();
      unlinkedRows.push({
        ...rollups,
        kind: 'unlinked',
        channel: latest.channel,
        handle,
        displayTitle: handle,
        latestMessageAt: latest.last_message_at ?? latest.created_at,
        latestPreview: latest.last_message_preview ?? latest.subject ?? null,
        unreadCount,
        hasUnread: unreadCount > 0,
        channels: [...channels],
        latestConversationIdByChannel: latestByChannel,
        latestConversationId: latest.id,
        conversationIds: group.map((c) => c.id),
      });
    });

    const combined: CustomerThreadRow[] =
      listFilter === 'unlinked' ? unlinkedRows : [...linkedRows, ...unlinkedRows];

    return combined.sort((a, b) => {
      const aTs = new Date(a.latestMessageAt ?? 0).getTime();
      const bTs = new Date(b.latestMessageAt ?? 0).getTime();
      if (aTs !== bTs) return bTs - aTs;
      return a.groupKey.localeCompare(b.groupKey);
    });
  }, [conversations, customerNameById, channelFilter, listFilter]);

  return { rows, isLoading, isError };
}
