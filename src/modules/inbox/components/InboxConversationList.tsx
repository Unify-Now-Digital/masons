import React, { useEffect, useMemo, useRef } from 'react';
import { Search, Mail, Phone, MessageCircle, Trash2, Eye, EyeOff, Plus } from 'lucide-react';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { formatConversationTimestamp } from '@/modules/inbox/utils/conversationUtils';
import type { InboxConversation } from '@/modules/inbox/types/inbox.types';
import { cn } from '@/shared/lib/utils';
import { InboxAvatarPill } from '@/modules/inbox/components/InboxAvatarPill';
import { InboxFilterPill } from '@/modules/inbox/components/InboxFilterPill';
import { InboxStatusBadge } from '@/modules/inbox/components/InboxStatusBadge';
import { useOrdersByPersonIds } from '@/modules/orders/hooks/useOrders';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';

export type ListFilter = 'all' | 'unread' | 'urgent' | 'unlinked';
export type ChannelFilter = 'all' | 'email' | 'sms' | 'whatsapp';

const CHANNEL_OPTIONS: { value: ChannelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

function isUrgent(conversation: InboxConversation): boolean {
  const subject = conversation.subject ?? '';
  const preview = conversation.last_message_preview ?? '';
  return /urgent/i.test(subject) || /urgent/i.test(preview);
}

function deriveInitials(personName: string, primaryHandle: string): string {
  const name = (personName || primaryHandle || '').trim();
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0].charAt(0);
    const b = parts[1].charAt(0);
    return `${a}${b}`.toUpperCase().slice(0, 2);
  }
  return name.slice(0, 2).toUpperCase();
}

const RELATED_ORDERS_MAX = 3;
const MAX_BULK_SELECTION = 50;

/** Format up to max order IDs; append ", ..." when there are more. Latest first. */
function formatRelatedOrderIds(orderIds: string[], max: number = RELATED_ORDERS_MAX): string {
  if (orderIds.length === 0) return '';
  const show = orderIds.slice(0, max);
  const suffix = orderIds.length > max ? ', ...' : '';
  return show.join(', ') + suffix;
}

/** Compact channel pill for metadata line: icon + label, single-line with order IDs */
function ChannelPill({ channel }: { channel: string }) {
  const isWhatsApp = channel === 'whatsapp';
  const isEmail = channel === 'email';
  const label = channel.charAt(0).toUpperCase() + channel.slice(1);
  const Icon = isEmail ? Mail : isWhatsApp ? MessageCircle : Phone;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-medium shrink-0',
        isWhatsApp ? 'bg-gardens-grn-lt text-gardens-grn-dk' : 'bg-gardens-page text-gardens-txs'
      )}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {label}
    </span>
  );
}

interface InboxConversationListProps {
  listFilter: ListFilter;
  channelFilter: ChannelFilter;
  searchQuery: string;
  onListFilterChange: (filter: ListFilter) => void;
  onChannelFilterChange: (channel: ChannelFilter) => void;
  onSearchChange: (value: string) => void;
  conversations: InboxConversation[];
  selectedConversationId: string | null;
  selectedItems: string[];
  onSelectConversation: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onNewClick: () => void;
  onDeleteClick: () => void;
  onToggleReadUnreadClick: () => void;
  deleteDisabled: boolean;
  toggleReadUnreadDisabled: boolean;
  anyToggleTargetUnread: boolean;
  isLoading: boolean;
  isError: boolean;
  hasGmailConnection?: boolean;
}

const FILTER_BUTTONS: { value: ListFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'unlinked', label: 'Unlinked' },
];

export const InboxConversationList: React.FC<InboxConversationListProps> = ({
  listFilter,
  channelFilter,
  searchQuery,
  onListFilterChange,
  onChannelFilterChange,
  onSearchChange,
  conversations,
  selectedConversationId,
  selectedItems,
  onSelectConversation,
  onToggleSelection,
  onNewClick,
  onDeleteClick,
  onToggleReadUnreadClick,
  deleteDisabled,
  toggleReadUnreadDisabled,
  anyToggleTargetUnread,
  isLoading,
  isError,
  hasGmailConnection = false,
}) => {
  const { data: customers = [] } = useCustomersList();
  const personNameMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
      map.set(c.id, name || c.email || c.phone || '—');
    });
    return map;
  }, [customers]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0),
    [conversations]
  );

  const uniquePersonIds = useMemo(
    () => [...new Set(conversations.map((c) => c.person_id).filter(Boolean))] as string[],
    [conversations]
  );
  const { data: ordersForPersons = [] } = useOrdersByPersonIds(uniquePersonIds);
  const orderDisplayIdsByPersonId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const order of ordersForPersons) {
      const pid = order.person_id;
      if (!pid) continue;
      const id = getOrderDisplayId(order);
      const list = map.get(pid) ?? [];
      list.push(id);
      map.set(pid, list);
    }
    return map;
  }, [ordersForPersons]);

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedCount = selectedItems.length;
  const visibleConversationIds = useMemo(() => conversations.map((c) => c.id), [conversations]);
  const visibleSelectedCount = useMemo(
    () => visibleConversationIds.filter((id) => selectedItems.includes(id)).length,
    [visibleConversationIds, selectedItems],
  );
  const allVisibleSelected = visibleConversationIds.length > 0 && visibleSelectedCount === visibleConversationIds.length;
  const canSelectMore = selectedCount < MAX_BULK_SELECTION;
  const canSelectAllVisible = canSelectMore || allVisibleSelected;

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      visibleConversationIds.forEach((id) => {
        if (selectedItems.includes(id)) onToggleSelection(id);
      });
      return;
    }

    const remainingCapacity = MAX_BULK_SELECTION - selectedCount;
    if (remainingCapacity <= 0) return;

    const toAdd = visibleConversationIds
      .filter((id) => !selectedItems.includes(id))
      .slice(0, remainingCapacity);
    toAdd.forEach((id) => onToggleSelection(id));
  };

  useEffect(() => {
    if (!selectedConversationId) return;
    if (!listContainerRef.current) return;
    if (!conversations.length) return;

    const el = listContainerRef.current.querySelector<HTMLButtonElement>(
      `[data-conversation-id="${selectedConversationId}"]`
    );

    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedConversationId, conversations]);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-gardens-surf rounded-lg">
      {/* Inbox header: title + actions */}
      <div className="shrink-0 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            disabled={!visibleConversationIds.length || !canSelectAllVisible}
            aria-label="Select all visible conversations"
            title={
              !canSelectAllVisible && !allVisibleSelected
                ? `Selection limit reached (${MAX_BULK_SELECTION})`
                : 'Select all visible conversations'
            }
            className="h-4 w-4 rounded border-gardens-bdr text-gardens-acc focus:ring-gardens-acc/40 disabled:opacity-50"
            onChange={handleToggleSelectAllVisible}
          />
          <h2 className="font-head text-sm font-semibold text-gardens-tx">
            Inbox {unreadTotal > 0 && <span className="text-gardens-txm font-normal">{unreadTotal} new</span>}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onNewClick}
            className="inline-flex items-center rounded-md border border-gardens-bdr bg-gardens-surf2 px-2 py-1 text-[11px] font-medium text-gardens-txs hover:bg-gardens-page"
          >
            <Plus className="h-3 w-3 mr-1" />
            <span>New</span>
          </button>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onDeleteClick}
              disabled={deleteDisabled}
              className="inline-flex items-center rounded-md border border-gardens-bdr bg-gardens-surf2 px-2 py-1 text-[11px] font-medium text-gardens-txs hover:bg-gardens-page disabled:opacity-50 disabled:pointer-events-none"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              <span>Delete ({selectedCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleReadUnreadClick}
            disabled={toggleReadUnreadDisabled}
            className="inline-flex items-center rounded-md bg-gardens-acc px-2 py-1 text-[11px] font-medium text-white hover:bg-gardens-acc-dk disabled:opacity-50 disabled:pointer-events-none"
          >
            {anyToggleTargetUnread ? (
              <>
                <Eye className="h-3 w-3 mr-1" />
                <span>Mark as Read</span>
              </>
            ) : (
              <>
                <EyeOff className="h-3 w-3 mr-1" />
                <span>Mark as Unread</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter pills + channel dropdown (single row) */}
      <div className="flex items-center gap-2 shrink-0 pb-2 min-w-0">
        <div className="flex items-center gap-1.5 flex-nowrap min-w-0 overflow-hidden">
          {FILTER_BUTTONS.map(({ value, label }) => (
            <InboxFilterPill
              key={value}
              label={label}
              selected={listFilter === value}
              onClick={() => onListFilterChange(value)}
            />
          ))}
        </div>
        <select
          value={channelFilter}
          onChange={(e) => onChannelFilterChange(e.target.value as ChannelFilter)}
          className="shrink-0 h-6 rounded-md border border-gardens-bdr bg-gardens-surf2 pl-2 pr-5 text-[11px] font-medium text-gardens-txs focus:outline-none focus:ring-2 focus:ring-gardens-acc/30 focus:border-gardens-acc"
        >
          {CHANNEL_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Search: custom input, no shadcn */}
      <div className="relative shrink-0 mb-2">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gardens-txm pointer-events-none" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-8 pl-8 pr-3 text-sm rounded-lg border border-gardens-bdr bg-gardens-surf2 text-gardens-tx placeholder:text-gardens-txm focus:outline-none focus:ring-2 focus:ring-gardens-acc/30 focus:border-gardens-acc"
        />
      </div>

      {/* Conversation list */}
      <div
        ref={listContainerRef}
        className="flex-1 min-h-0 overflow-auto scrollbar-hide px-0.5"
      >
        {isLoading ? (
          <div className="p-6 text-center text-slate-500">
            <Mail className="h-9 w-9 mx-auto mb-2 text-slate-300" />
            <p className="text-xs">Loading conversations...</p>
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-slate-500">
            <Mail className="h-9 w-9 mx-auto mb-2 text-slate-300" />
            <p className="text-xs">Unable to load conversations</p>
          </div>
        ) : !conversations?.length ? (
          <div className="p-6 text-center text-slate-500">
            <Mail className="h-9 w-9 mx-auto mb-2 text-slate-300" />
            {channelFilter === 'email' && !hasGmailConnection ? (
              <p className="text-xs">Connect Gmail to sync and send email from this inbox.</p>
            ) : (
              <p className="text-xs">No conversations found</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gardens-bdr">
            {conversations.map((conversation) => {
              const personName = conversation.person_id
                ? personNameMap.get(conversation.person_id) ?? conversation.primary_handle
                : conversation.primary_handle;
              const showUnlinked = !conversation.person_id || (conversation.link_state ?? 'unlinked') !== 'linked';
              const urgent = isUrgent(conversation);
              const isSelected = selectedConversationId === conversation.id;
              const initials = deriveInitials(personName, conversation.primary_handle);
              const statusDot = urgent ? 'urgent' : showUnlinked ? 'unlinked' : undefined;
              const showGoldDot = isSelected || urgent || (conversation.unread_count > 0);
              const previewFirst = conversation.subject || conversation.last_message_preview || 'No preview';
              const previewSecond = conversation.subject && conversation.last_message_preview
                ? conversation.last_message_preview
                : null;
              const orderDisplayIds = conversation.person_id
                ? orderDisplayIdsByPersonId.get(conversation.person_id) ?? []
                : [];
              const orderIdsText = formatRelatedOrderIds(orderDisplayIds);
              const isChecked = selectedItems.includes(conversation.id);

              return (
                <div key={conversation.id} className="relative group">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    aria-label={`Select conversation with ${personName}`}
                    className={cn(
                      'absolute left-2 top-3 h-4 w-4 rounded border-gardens-bdr text-gardens-acc focus:ring-gardens-acc/40 z-10',
                      isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                    )}
                    onChange={() => onToggleSelection(conversation.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    data-conversation-id={conversation.id}
                    type="button"
                    className={cn(
                      'w-full text-left py-2 px-2 pl-8 rounded-lg transition-colors flex items-start gap-2',
                      'border-l-2 border-transparent',
                      'focus:outline-none focus:ring-0',
                      isSelected
                        ? 'bg-gardens-acc-lt border-l-gardens-acc'
                        : 'bg-gardens-surf2 hover:bg-gardens-page border-l-transparent'
                    )}
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    <InboxAvatarPill initials={initials} statusDot={statusDot} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1 pt-0.5 overflow-hidden">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                          <span className="font-head font-semibold text-[13px] text-gardens-tx truncate">
                            {personName}
                          </span>
                          {showGoldDot && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-gardens-acc shrink-0 mt-1.5"
                              aria-hidden
                            />
                          )}
                        </div>
                        <span className="text-[11px] text-gardens-txm shrink-0 whitespace-nowrap">
                          {formatConversationTimestamp(conversation.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-nowrap min-w-0 mt-0.5 overflow-hidden">
                        <ChannelPill channel={conversation.channel} />
                        {orderIdsText && (
                          <span className="text-[10px] text-gardens-txm font-mono truncate min-w-0">
                            {orderIdsText}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 min-w-0 overflow-hidden">
                        <p className="text-[12px] font-medium text-gardens-tx truncate leading-snug">
                          {previewFirst}
                        </p>
                        {previewSecond && (
                          <p className="text-[11px] text-gardens-txs truncate leading-snug mt-0.5">
                            {previewSecond}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {conversation.unread_count > 0 && (
                          <InboxStatusBadge variant="action">
                            Unread
                          </InboxStatusBadge>
                        )}
                        {urgent && <InboxStatusBadge variant="urgent">Urgent</InboxStatusBadge>}
                        {showUnlinked && <InboxStatusBadge variant="unlinked">Unlinked</InboxStatusBadge>}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Ensure the selected conversation row is scrolled into view when selection changes.
// This keeps the left list visually in sync when selection is driven externally
// (e.g., via Reply via channel pills in the composer).
export const useScrollSelectedConversationIntoView = (
  containerRef: React.RefObject<HTMLDivElement>,
  selectedConversationId: string | null,
  conversations: InboxConversation[]
) => {
  useEffect(() => {
    if (!selectedConversationId) return;
    if (!containerRef.current) return;
    if (!conversations.length) return;

    const el = containerRef.current.querySelector<HTMLButtonElement>(
      `[data-conversation-id="${selectedConversationId}"]`
    );

    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedConversationId, conversations, containerRef]);
};
