import { useMemo } from 'react';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { useConversationsList } from './useInboxConversations';
import type {
  ConversationFilters,
  ConversationIdByChannel,
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

function normalizeHandle(raw: string): string {
  return raw.trim();
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
    const linkedGroups = new Map<string, InboxConversation[]>();
    const unlinkedGroups = new Map<string, InboxConversation[]>();

    conversations.forEach((conversation) => {
      if (listFilter === 'urgent' && !isUrgent(conversation)) return;

      const pid = conversation.person_id;
      if (pid) {
        const list = linkedGroups.get(pid) ?? [];
        list.push(conversation);
        linkedGroups.set(pid, list);
        return;
      }

      const handle = normalizeHandle(conversation.primary_handle ?? '');
      if (!handle) return;
      const ukey = `${conversation.channel}\0${handle}`;
      const list = unlinkedGroups.get(ukey) ?? [];
      list.push(conversation);
      unlinkedGroups.set(ukey, list);
    });

    const linkedRows: CustomerThreadRow[] = [];
    if (listFilter !== 'unlinked') {
      linkedGroups.forEach((group, personId) => {
        const sortedByRecent = group.slice().sort((a, b) => {
          const aTs = new Date(a.last_message_at ?? a.created_at).getTime();
          const bTs = new Date(b.last_message_at ?? b.created_at).getTime();
          return bTs - aTs;
        });
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
        linkedRows.push({
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
      });
    }

    const unlinkedRows: CustomerThreadRow[] = [];
    unlinkedGroups.forEach((group, ukey) => {
      const sep = ukey.indexOf('\0');
      const channel = ukey.slice(0, sep) as InboxChannel;
      const handle = ukey.slice(sep + 1);
      if (channelFilter !== 'all' && channel !== channelFilter) return;

      const sortedByRecent = group.slice().sort((a, b) => {
        const aTs = new Date(a.last_message_at ?? a.created_at).getTime();
        const bTs = new Date(b.last_message_at ?? b.created_at).getTime();
        return bTs - aTs;
      });
      const latest = sortedByRecent[0];
      const latestByChannel: ConversationIdByChannel = {
        email: null,
        sms: null,
        whatsapp: null,
      };
      sortedByRecent.forEach((c) => {
        if (!latestByChannel[c.channel]) latestByChannel[c.channel] = c.id;
      });
      const unreadCount = group.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

      unlinkedRows.push({
        kind: 'unlinked',
        channel,
        handle,
        displayTitle: handle,
        latestMessageAt: latest.last_message_at ?? latest.created_at,
        latestPreview: latest.last_message_preview ?? latest.subject ?? null,
        unreadCount,
        hasUnread: unreadCount > 0,
        channels: [channel],
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
      const ka = a.kind === 'linked' ? a.personId : `${a.channel}:${a.handle}`;
      const kb = b.kind === 'linked' ? b.personId : `${b.channel}:${b.handle}`;
      return ka.localeCompare(kb);
    });
  }, [conversations, customerNameById, channelFilter, listFilter]);

  return { rows, isLoading, isError };
}
