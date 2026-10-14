import React, { useEffect, useRef } from 'react';
import { Check, Eye, EyeOff, Filter, Globe, Mail, MessageCircle, Phone, Search, Users } from 'lucide-react';
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
import { useEnquiryLabelByPersonId } from '@/modules/inbox/hooks/useEnquiryLabelByPersonId';
import { inquiryRowLabel } from '@/modules/inbox/utils/inquiryRowLabel';
import type { AgingInfo, InboxBucket } from '@/modules/inbox/utils/inboxBuckets';
import { useCustomerFlagByPersonId } from '@/modules/inbox/hooks/useCustomerFlagByPersonId';
import { useMutedSenders } from '@/modules/inbox/hooks/useMutedSenders';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { isOrderOpen } from '@/modules/inbox/utils/inboxBuckets';
import { inboxCue, inboxRowAction, isColdRow, rowPrimary, showsRowChip, type InboxOrderLike, type InboxRowAction } from '@/modules/inbox/utils/inboxRowAction';
import { sortCustomerRows } from '@/modules/inbox/utils/customerRowSort';
import { ActionChip, ReplyTimer } from '@/shared/components/mason';
import { useNavigate } from 'react-router-dom';
import { AlarmClock } from 'lucide-react';

// 'unread' is retained deliberately (ruled at C3c). The customers view no longer uses it —
// unread there is the independent `unreadOnly` boolean on UnifiedInboxPage — but the
// Conversations tab's own ListFilter still emits it through the shared setListFilter, and
// that assignment typechecks only while this union stays a superset of ListFilter.
// Removing it is a tsc error, not a cleanup.
export type CustomerListFilter = 'all' | 'customers' | 'inquiries' | 'unread' | 'awaiting' | 'urgent' | 'unlinked' | 'stuck' | 'hidden';
export type CustomerChannelFilter = 'all' | 'email' | 'sms' | 'whatsapp' | 'web';

/** 3-way segmented control: All / Customers / Inquiries (2026-10-14; was a cycling pill). */
const FILTER_CYCLE: { value: Extract<CustomerListFilter, 'all' | 'customers' | 'inquiries'>; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'customers', label: 'Customers' },
  { value: 'inquiries', label: 'Inquiries' },
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
  const { data: customerFlagByPersonId } = useCustomerFlagByPersonId();
  const { data: enquiryByPersonId } = useEnquiryLabelByPersonId();
  const { organizationId } = useOrganization();
  const { mute, unmute } = useMutedSenders(organizationId);
  const navigate = useNavigate();
  // Same cached query the page already loads for classification (no extra fetch).
  const { data: ordersData } = useOrdersList();
  const openOrdersByPerson = React.useMemo(() => {
    const m = new Map<string, InboxOrderLike[]>();
    for (const o of ordersData ?? []) {
      if (!o.person_id || !isOrderOpen(o)) continue;
      const list = m.get(o.person_id) ?? [];
      list.push(o as unknown as InboxOrderLike);
      m.set(o.person_id, list);
    }
    return m;
  }, [ordersData]);
  const actionByKey = React.useMemo(() => {
    const m = new Map<string, InboxRowAction>();
    for (const row of rows) {
      const personOrders = row.kind === 'linked' ? openOrdersByPerson.get(row.personId) ?? [] : [];
      m.set(customerThreadRowStableKey(row), inboxRowAction(groupWorstAging(row, bucketAndAgingByConversationId), personOrders));
    }
    return m;
  }, [rows, openOrdersByPerson, bucketAndAgingByConversationId]);
  // Same order as the page (sortCustomerRows): chased newest-first, then them, then cold.
  const sortedRows = React.useMemo(
    () => sortCustomerRows(rows, bucketAndAgingByConversationId),
    [rows, bucketAndAgingByConversationId],
  );
  const coldKeys = React.useMemo(() => {
    const now = Date.now();
    return new Set(rows.filter((r) => isColdRow(r, now)).map(customerThreadRowStableKey));
  }, [rows]);
  const cue = React.useMemo(
    () => inboxCue([...actionByKey.entries()].map(([k, a]) => ({ ...a, cold: coldKeys.has(k) }))),
    [actionByKey, coldKeys],
  );

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
        {(() => {
          const cycleValues = FILTER_CYCLE.map((c) => c.value);
          const active = (cycleValues.includes(listFilter as (typeof cycleValues)[number])
            ? listFilter
            : 'all') as (typeof cycleValues)[number];
          return (
            <div
              role="radiogroup"
              aria-label="Show"
              className="shrink-0 inline-flex items-center rounded-full border border-gardens-bdr bg-gardens-page p-0.5 gap-0.5"
              data-testid="inbox-scope"
            >
              {FILTER_CYCLE.map((opt) => {
                const on = listFilter !== 'hidden' && active === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onListFilterChange(opt.value)}
                    className={cn(
                      'px-2 py-0.5 text-[11px] font-medium rounded-full whitespace-nowrap transition-colors',
                      on ? 'bg-gardens-acc-lt text-gardens-acc-dk shadow-sm' : 'text-gardens-txs hover:text-gardens-tx',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          );
        })()}
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

      {!isLoading && !isError && rows.length > 0 && (
        <div
          className="shrink-0 mb-1 px-2 py-2 rounded-lg border border-gardens-bdr bg-gardens-surf flex items-center gap-2 min-w-0"
          data-testid="inbox-cue"
          aria-live="polite"
        >
          <AlarmClock className="h-4 w-4 text-gardens-tx shrink-0" aria-hidden />
          <span className="text-[14px] font-bold text-gardens-tx whitespace-nowrap">
            {cue.needYou} need{cue.needYou === 1 ? 's' : ''} you now
          </span>
          {(cue.overdue > 0 || cue.dueSoon > 0) && (
            <span className="text-xs text-gardens-txs truncate">
              {cue.overdue > 0 && <b className="text-gardens-sem-red">{cue.overdue} overdue</b>}
              {cue.overdue > 0 && cue.dueSoon > 0 && ' · '}
              {cue.dueSoon > 0 && <b className="text-gardens-sem-amber">{cue.dueSoon} due soon</b>}
            </span>
          )}
        </div>
      )}

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
            {sortedRows.map((row) => {
              const key = customerThreadRowStableKey(row);
              const selected = customersSelectionsEqual(customersSelection, customersSelectionFromRow(row));
              const isCustomer =
                row.kind === 'linked' && customerFlagByPersonId?.get(row.personId) === true;
              const isUnread = row.unreadCount > 0;
              const previewFirst = row.latestSubject || row.latestPreview || 'No preview';
              const rowAction = actionByKey.get(key);
              const isCold = coldKeys.has(key);
              // Chip only for non-reply steps (deposit / permit / proof / balance / order);
              // a reply owed is the timer's job. Cold rows get no chip.
              const chipVisible = !!rowAction && !isCold && showsRowChip(rowAction.action);
              return (
                <div key={key} ref={selected ? selectedRowRef : undefined} className={cn('relative group', isCold && 'opacity-60')}>
                  <button
                    type="button"
                    onClick={() => onSelectCustomersRow(row)}
                    className={cn(
                      'w-full text-left py-2 px-2 rounded-lg transition-colors flex items-start gap-2',
                      'border-l-2 border-transparent',
                      'focus:outline-none focus:ring-0',
                      selected
                        ? 'bg-gardens-acc-lt border-l-gardens-acc'
                        : 'bg-gardens-surf2 hover:bg-gardens-page border-l-transparent'
                    )}
                  >
                    {/* Two-line row (v10): who · timer / why · action. Unread = dot + bold. */}
                    <span
                      className={cn('mt-[7px] h-2 w-2 rounded-full shrink-0', isUnread ? 'bg-gardens-tx' : 'bg-transparent')}
                      aria-label={isUnread ? 'Unread' : undefined}
                      role={isUnread ? 'img' : undefined}
                    />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={cn(
                            'font-head text-[14px] text-gardens-tx truncate min-w-0',
                            isUnread ? 'font-bold' : 'font-medium'
                          )}
                        >
                          {rowTitle(row)}
                        </span>
                        {(() => {
                          const chip = inquiryRowLabel({
                            isCustomer,
                            enquiry:
                              row.kind === 'linked'
                                ? enquiryByPersonId?.get(row.personId)
                                : undefined,
                          });
                          return (
                            <span className="shrink-0 text-[11px] text-gardens-txm-aa whitespace-nowrap">
                              {row.kind === 'unlinked' ? 'Unlinked' : chip}
                            </span>
                          );
                        })()}
                        <span className="ml-auto shrink-0">
                          {rowAction?.timer && !isCold ? (
                            <ReplyTimer timer={rowAction.timer} />
                          ) : (
                            <span className="text-[11px] text-gardens-txm-aa whitespace-nowrap">
                              {formatConversationTimestamp(row.latestMessageAt)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 min-w-0">
                        <p
                          className={cn(
                            'flex-1 min-w-0 text-[13px] truncate leading-snug',
                            isUnread ? 'font-semibold text-gardens-tx' : 'font-normal text-gardens-txs'
                          )}
                          title={previewFirst}
                        >
                          {previewFirst}
                        </p>
                        {chipVisible && <span aria-hidden className={selected ? 'w-36 shrink-0' : 'w-6 shrink-0'} />}
                      </div>
                    </div>
                  </button>
                  {chipVisible && rowAction && rowAction.action.kind !== 'waiting' && rowAction.action.kind !== 'none' && (
                    <ActionChip
                      kind={rowAction.action.kind}
                      label={rowAction.action.label}
                      solid={selected}
                      expanded={selected}
                      className="absolute right-2 bottom-2 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!selected) onSelectCustomersRow(row);
                        const target = rowPrimary(rowAction)?.target;
                        if (target && target !== 'composer') navigate(target);
                      }}
                    />
                  )}
                  {!row.isMuted && row.kind === 'unlinked' && !chipVisible && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        mute.mutate(row.handle);
                      }}
                      disabled={mute.isPending}
                      title="Hide sender — move this sender to Hidden (undo from Hidden)"
                      aria-label={`Hide sender ${row.handle}`}
                      className="absolute right-2 bottom-2 z-10 hidden group-hover:inline-flex group-focus-within:inline-flex items-center rounded-md border border-gardens-bdr bg-gardens-surf2 px-1.5 py-0.5 text-[11px] font-medium text-gardens-txs hover:bg-gardens-page disabled:opacity-50"
                    >
                      <EyeOff className="h-3 w-3 mr-1" aria-hidden />
                      <span>Hide</span>
                    </button>
                  )}
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
