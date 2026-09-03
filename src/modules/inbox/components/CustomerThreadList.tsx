import React, { useEffect, useRef } from 'react';
import { Check, Eye, Filter, Globe, Mail, MessageCircle, Phone, Search, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { formatConversationTimestamp } from '@/modules/inbox/utils/conversationUtils';
import type { CustomerThreadRow, CustomersSelection } from '@/modules/inbox/types/inbox.types';
import { customerThreadRowStableKey, customersSelectionsEqual, customersSelectionFromRow } from '@/modules/inbox/types/inbox.types';
import { ChannelPill } from '@/modules/inbox/components/InboxConversationList';
import { InboxFilterPillRow } from '@/modules/inbox/components/InboxFilterPill';
import { InboxAgingBadge } from '@/modules/inbox/components/InboxAgingBadge';
import type { AgingInfo, InboxBucket } from '@/modules/inbox/utils/inboxBuckets';
import { ScoreBadge } from '@/shared/components/ScoreBadge';
import { useCustomerScores } from '@/modules/customers/hooks/useCustomerScores';
import { useCustomerFlagByPersonId } from '@/modules/inbox/hooks/useCustomerFlagByPersonId';
import { useMutedSenders } from '@/modules/inbox/hooks/useMutedSenders';
import { useOrganization } from '@/shared/context/OrganizationContext';

// 'unread' is retained deliberately (ruled at C3c). The customers view no longer uses it —
// unread there is the independent `unreadOnly` boolean on UnifiedInboxPage — but the
// Conversations tab's own ListFilter still emits it through the shared setListFilter, and
// that assignment typechecks only while this union stays a superset of ListFilter.
// Removing it is a tsc error, not a cleanup.
export type CustomerListFilter = 'all' | 'customers' | 'unread' | 'awaiting' | 'urgent' | 'unlinked' | 'stuck' | 'hidden';
export type CustomerChannelFilter = 'all' | 'email' | 'sms' | 'whatsapp' | 'web';

const FILTER_BUTTONS: { value: CustomerListFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'customers', label: 'Customers' },
];

const CHANNEL_OPTIONS: { value: CustomerChannelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'web', label: 'GHL' },
];

// Trigger icon mirrors the selection: an icon-only control otherwise gives no way
// to read the active channel. The channel→icon mapping is ChannelPill's
// (InboxConversationList.tsx:59); 'all' is the only addition.
const CHANNEL_ICONS: Record<CustomerChannelFilter, LucideIcon> = {
  all: Filter,
  email: Mail,
  sms: Phone,
  whatsapp: MessageCircle,
  web: Globe,
};

type BucketAging = { bucket: InboxBucket; aging: AgingInfo | null };

/**
 * Reply-clock badge input for a grouped row. Us-side takes priority: the worst
 * (stalest) member we owe a reply on, if any; otherwise the worst them-side
 * member. The side rides along in `aging.ball.side` so the badge can mark
 * Us vs Them.
 */
function groupWorstAging(
  row: CustomerThreadRow,
  bucketAndAgingByConversationId: Map<string, BucketAging>
): BucketAging | null {
  let worstUs: BucketAging | null = null;
  let worstThem: BucketAging | null = null;
  for (const id of row.conversationIds) {
    const entry = bucketAndAgingByConversationId.get(id);
    if (!entry?.aging) continue;
    if (entry.aging.ball.side === 'us') {
      if (!worstUs || entry.aging.ball.sinceMs > worstUs.aging!.ball.sinceMs) worstUs = entry;
    } else {
      if (!worstThem || entry.aging.ball.sinceMs > worstThem.aging!.ball.sinceMs) worstThem = entry;
    }
  }
  return worstUs ?? worstThem;
}

function rowTitle(row: CustomerThreadRow): string {
  return row.kind === 'linked' ? row.displayName : row.displayTitle;
}

function rowInitials(row: CustomerThreadRow): string {
  const t = rowTitle(row).trim();
  if (t.length >= 2) return t.slice(0, 2).toUpperCase();
  return t ? t.toUpperCase() : '?';
}

interface CustomerThreadListProps {
  listFilter: CustomerListFilter;
  channelFilter: CustomerChannelFilter;
  searchQuery: string;
  onListFilterChange: (filter: CustomerListFilter) => void;
  onChannelFilterChange: (value: CustomerChannelFilter) => void;
  onSearchChange: (value: string) => void;
  rows: CustomerThreadRow[];
  customersSelection: CustomersSelection | null;
  onSelectCustomersRow: (row: CustomerThreadRow) => void;
  isLoading: boolean;
  isError: boolean;
  /** Bucket + aging per conversation, computed once at the page level (same map as InboxConversationList). */
  bucketAndAgingByConversationId: Map<string, BucketAging>;
  /** C6: the page-owned icon cluster (Unread, Hidden, Mark unread, "+", Collapse),
   *  placed in this component's pill row after the divider. A slot rather than nine
   *  props: every icon closes over UnifiedInboxPage state, and `listFilter` arrives
   *  here already narrowed ('urgent'/'stuck' -> 'all') while the Hidden toggle needs
   *  the un-narrowed value. Ownership does not move; only placement does. */
  headerActions?: React.ReactNode;
}

export const CustomerThreadList: React.FC<CustomerThreadListProps> = ({
  listFilter,
  channelFilter,
  searchQuery,
  onListFilterChange,
  onChannelFilterChange,
  onSearchChange,
  rows,
  customersSelection,
  onSelectCustomersRow,
  isLoading,
  isError,
  bucketAndAgingByConversationId,
  headerActions,
}) => {
  const { data: customerScores } = useCustomerScores();
  const scoreByPersonId = new Map((customerScores ?? []).map((s) => [s.id, s]));
  const { data: customerFlagByPersonId } = useCustomerFlagByPersonId();
  const { organizationId } = useOrganization();
  const { unmute } = useMutedSenders(organizationId);

  // Keep the selected row visible: scoped to selection *changes* (keyed on the
  // stable row key) with block:'nearest', so an already-visible row (the
  // default top-row auto-select, or a user click) scrolls nothing at all.
  // Exists for the ?conversation= deep link, which can select an off-screen row.
  const selectedRowRef = useRef<HTMLDivElement | null>(null);
  const selectedRow = customersSelection
    ? rows.find((row) => customersSelectionsEqual(customersSelection, customersSelectionFromRow(row)))
    : undefined;
  const selectedRowStableKey = selectedRow ? customerThreadRowStableKey(selectedRow) : null;
  useEffect(() => {
    if (!selectedRowStableKey) return;
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedRowStableKey]);

  const ChannelIcon = CHANNEL_ICONS[channelFilter];
  const channelActive = channelFilter !== 'all';
  const channelLabel = CHANNEL_OPTIONS.find((o) => o.value === channelFilter)?.label ?? 'All';

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {/* Pills, the channel control and the page-owned icon cluster share ONE row
          (C6 ruling, 2026-09-03; supersedes C5a's two-row placement). Left: pills.
          Then a thin divider — the C8 precedent at InvoiceWorkspace.tsx:662, a span
          with ml-2 pl-3 border-l on var(--g-bdr). Right of it, ONE group: the channel
          trigger joins the icons (ruled) rather than sitting alone at the row's far
          edge, and leads the group as the third filter — channel, unread, hidden —
          ahead of the two actions and the panel-level Collapse. InboxFilterPillRow
          carries min-w-0 + overflow-x-auto, so it yields to the shrink-0 group and
          the row cannot overflow. */}
      <div className="flex flex-row items-center justify-between gap-2 shrink-0 pb-2 min-w-0">
        <InboxFilterPillRow
          options={FILTER_BUTTONS}
          value={listFilter}
          onChange={onListFilterChange}
        />
        <span
          className="shrink-0 flex items-center gap-1 ml-2 pl-3 border-l"
          style={{ borderColor: 'var(--g-bdr)' }}
        >
          {/* Icon-only trigger, full labels on open (C5a). DropdownMenu per the in-module
              JobPicker precedent — shadcn Select hardcodes its own chevron and expects a
              SelectValue text slot. No asChild: no function-valued className crosses a
              Radix trigger. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Channel filter: ${channelLabel}`}
              title="Channel"
              className="shrink-0 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-gardens-grn/30"
              style={{
                // Same active pairing as the page-level filter icons (R-003 idiom).
                background: channelActive ? 'var(--g-acc-lt)' : 'transparent',
                border: `1px solid ${channelActive ? 'var(--g-acc)' : 'transparent'}`,
                color: channelActive ? 'var(--g-acc-dk)' : 'var(--g-tx)',
              }}
            >
              <ChannelIcon className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CHANNEL_OPTIONS.map(({ value, label }) => (
                <DropdownMenuItem
                  key={value}
                  onSelect={() => onChannelFilterChange(value)}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      value === channelFilter ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="text-[12px]">{label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {headerActions}
        </span>
      </div>

      <div className="relative shrink-0 mb-2">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gardens-txs pointer-events-none" />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-8 pl-8 pr-3 text-sm rounded-lg border border-gardens-bdr bg-white text-gardens-tx placeholder:text-gardens-txs focus:outline-none focus:ring-2 focus:ring-gardens-grn/30 focus:border-gardens-grn"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto scrollbar-hide px-0.5">
        {isLoading ? (
          <div className="p-6 text-center text-gardens-txs">
            <Users className="h-9 w-9 mx-auto mb-2 text-gardens-txm" />
            <p className="text-xs">Loading customers...</p>
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-gardens-txs">
            <Users className="h-9 w-9 mx-auto mb-2 text-gardens-txm" />
            <p className="text-xs">Unable to load customers</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-gardens-txs">
            <Users className="h-9 w-9 mx-auto mb-2 text-gardens-txm" />
            <p className="text-xs">No linked customers or unlinked threads found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {rows.map((row) => {
              const key = customerThreadRowStableKey(row);
              const selected = customersSelectionsEqual(customersSelection, customersSelectionFromRow(row));
              const score = row.kind === 'linked' ? scoreByPersonId.get(row.personId) : undefined;
              const isCustomer =
                row.kind === 'linked' && customerFlagByPersonId?.get(row.personId) === true;
              const isUnread = row.unreadCount > 0;
              const previewFirst = row.latestSubject || row.latestPreview || 'No preview';
              const worstAging = groupWorstAging(row, bucketAndAgingByConversationId);
              return (
                <div key={key} ref={selected ? selectedRowRef : undefined} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelectCustomersRow(row)}
                    className={cn(
                      'w-full text-left py-2 px-2 rounded-lg transition-colors flex items-start gap-2',
                      'border-l-2 border-transparent',
                      'focus:outline-none focus:ring-0',
                      selected
                        ? 'bg-gardens-acc-lt border-l-gardens-acc'
                        : isUnread
                          ? 'bg-gardens-grn-lt border-l-transparent'
                          : 'bg-gardens-surf2 hover:bg-gardens-page border-l-transparent'
                    )}
                  >
                    <div className="mt-0.5 h-8 w-8 rounded-full bg-gardens-bdr text-gardens-tx text-[11px] font-semibold flex items-center justify-center shrink-0">
                      {rowInitials(row)}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5 overflow-hidden">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            'font-head text-[13px] text-gardens-tx truncate',
                            isUnread ? 'font-bold' : 'font-medium'
                          )}
                        >
                          {rowTitle(row)}
                        </span>
                        <span className="text-[11px] text-gardens-txm shrink-0 whitespace-nowrap">
                          {formatConversationTimestamp(row.latestMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-nowrap min-w-0 mt-0.5 overflow-hidden">
                        {row.channels.map((channel) => (
                          <ChannelPill key={channel} channel={channel} />
                        ))}
                        {row.conversationCount > 1 && (
                          <span className="text-[10px] text-gardens-txm shrink-0">
                            {row.conversationCount} threads
                          </span>
                        )}
                        {row.kind === 'unlinked' && (
                          <span className="text-[10px] text-gardens-txm shrink-0">unlinked</span>
                        )}
                      </div>
                      <div className="mt-1 min-w-0 overflow-hidden">
                        <p
                          className={cn(
                            'text-[12px] truncate leading-snug',
                            isUnread ? 'font-semibold text-gardens-tx' : 'font-normal text-gardens-txs'
                          )}
                        >
                          {previewFirst}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                            isCustomer
                              ? 'bg-gardens-grn-lt text-gardens-grn-dk'
                              : 'bg-gardens-page text-gardens-txm'
                          )}
                        >
                          {isCustomer ? 'Customer' : 'Enquiry'}
                        </span>
                        {worstAging?.aging && (
                          <InboxAgingBadge bucket={worstAging.bucket} aging={worstAging.aging} showSide />
                        )}
                        {score && (
                          <ScoreBadge
                            score={score.score}
                            band={score.band}
                            breakdown={score.breakdown}
                            tone={isCustomer ? 'customer' : 'enquiry'}
                          />
                        )}
                        {row.hasUnread && (
                          <span className="inline-flex items-center rounded-full bg-gardens-amb-lt text-gardens-amb-dk px-1.5 py-0.5 text-[10px] font-medium">
                            Unread
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  {row.isMuted && row.kind === 'unlinked' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        unmute.mutate(row.handle);
                      }}
                      disabled={unmute.isPending}
                      title="Unmute sender — show this sender in the inbox again"
                      className="absolute right-2 bottom-2 z-10 inline-flex items-center rounded-md border border-gardens-bdr bg-gardens-surf2 px-2 py-1 text-[11px] font-medium text-gardens-txs hover:bg-gardens-page disabled:opacity-50"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      <span>Unmute</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
