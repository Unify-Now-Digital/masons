import { InboxFilterPill } from './InboxFilterPill';
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
import { useCustomerFlagByPersonId } from '@/modules/inbox/hooks/useCustomerFlagByPersonId';
import { useMutedSenders } from '@/modules/inbox/hooks/useMutedSenders';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { isOrderOpen } from '@/modules/inbox/utils/inboxBuckets';
import { inboxCue, inboxRowAction, isColdRow, rowExplanation, rowPrimary, type InboxOrderLike, type InboxRowAction, type LaneStats } from '@/modules/inbox/utils/inboxRowAction';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { viewerPrimary } from '@/modules/invoicing/invoiceBuilderAccess';
import { isAutomatedHandle } from '@/modules/inbox/utils/partnerHandles';
import { sortCustomerRows } from '@/modules/inbox/utils/customerRowSort';
import { ActionChip, ReplyTimer, WaitingChip } from '@/shared/components/mason';
import { useNavigate } from 'react-router-dom';
import { AlarmClock } from 'lucide-react';
import { InboxRow } from '@/modules/inbox/components/InboxRow';
import { useLatestPreviews } from '@/modules/inbox/hooks/useLatestPreviews';
import { InboxListSkeleton } from '@/modules/inbox/components/InboxListSkeleton';
import { groupWorstAging, type BucketAging } from './customerThreadListHelpers';

// 'unread' is retained deliberately (ruled at C3c). The customers view no longer uses it —
// unread there is the independent `unreadOnly` boolean on UnifiedInboxPage — but the
// Conversations tab's own ListFilter still emits it through the shared setListFilter, and
// that assignment typechecks only while this union stays a superset of ListFilter.
// Removing it is a tsc error, not a cleanup.
export type CustomerListFilter = 'all' | 'customers' | 'inquiries' | 'unread' | 'awaiting' | 'urgent' | 'unlinked' | 'stuck' | 'hidden';
export type CustomerChannelFilter = 'all' | 'email' | 'sms' | 'whatsapp' | 'web';


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
  /** inbox-v13 lane cards (Customers / Enquiries): counts computed at page level. */
  laneStats?: { customers: LaneStats; enquiries: LaneStats };
  /** Priority mode (default on): the ranked top-15 list replaces the rows for the lane. */
  priority?: { on: boolean; count: number; onToggle: (on: boolean) => void; content: React.ReactNode };
}

const CHANNEL_WORD: Record<string, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', web: 'Web form', phone: 'Call' };

/** Compact lane card (inbox-v13, made smaller per Arin 2026-10-14). */
const LaneCard: React.FC<{ label: string; hint: string; stats?: LaneStats; on: boolean; onClick: () => void; testId: string }> = ({
  label, hint, stats, on, onClick, testId,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={on}
    onClick={onClick}
    data-testid={testId}
    title={stats && stats.overdue > 0 ? `${hint} · ${stats.overdue} overdue` : hint}
    className={cn(
      'inline-flex h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-3 text-[12px] font-semibold transition-colors lg:h-6 lg:px-2 lg:text-[11px]',
      on ? 'bg-gardens-acc text-white' : 'text-gardens-txs hover:bg-gardens-page',
    )}
  >
    {label}
    <span className={cn('tabular-nums', on ? 'text-white/90' : 'text-gardens-tx')}>{stats ? stats.count : '—'}</span>
    {stats && stats.overdue > 0 && (
      <span className={cn('tabular-nums text-[11px]', on ? 'text-white/90' : 'text-gardens-sem-red')}>· {stats.overdue}!</span>
    )}
  </button>
);

function rowBall(row: CustomerThreadRow, map: Map<string, BucketAging>): { side: 'us' | 'them'; sinceMs: number } | null {
  let best: { side: 'us' | 'them'; sinceMs: number } | null = null;
  for (const id of row.conversationIds) {
    const b = map.get(id)?.aging?.ball;
    if (!b) continue;
    // us-side wins (someone is waiting on us); else the most recent them-side clock.
    if (!best || (b.side === 'us' && best.side !== 'us') || (b.side === best.side && b.sinceMs > best.sinceMs)) best = { side: b.side, sinceMs: b.sinceMs };
  }
  return best;
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
  laneStats,
  priority,
}) => {
  const { data: customerFlagByPersonId } = useCustomerFlagByPersonId();
  const { data: enquiryByPersonId } = useEnquiryLabelByPersonId();
  const { organizationId } = useOrganization();
  const { mute, unmute } = useMutedSenders(organizationId);
  const navigate = useNavigate();
  const canSeeMoney = useCanSeeMoney();
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
  const missingPreviewIds = React.useMemo(
    () => rows.flatMap((row) => {
      const stored = (row.latestSubject || row.latestPreview || '').trim();
      if (stored && stored !== 'No preview') return [];
      return row.conversationIds.length > 0 ? row.conversationIds : [row.latestConversationId];
    }),
    [rows],
  );
  const { data: fetchedPreviews } = useLatestPreviews(missingPreviewIds);
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
      <div className="flex min-w-0 flex-wrap items-center gap-1 pb-1">
      <div role="radiogroup" aria-label="Lane" className="flex min-w-0 flex-wrap items-center gap-0.5 rounded-lg border border-gardens-bdr bg-gardens-surf2 p-0.5" data-testid="inbox-lanes">
        <LaneCard
          testId="lane-customers"
          label="Customers"
          hint="Have an order"
          stats={laneStats?.customers}
          on={listFilter === 'customers'}
          onClick={() => onListFilterChange('customers')}
        />
        <LaneCard
          testId="lane-enquiries"
          label="Enquiries"
          hint="Waiting on us"
          stats={laneStats?.enquiries}
          on={listFilter === 'inquiries'}
          onClick={() => onListFilterChange('inquiries')}
        />
      </div>
      {!isLoading && !isError && rows.length > 0 && (
        <span
          className="flex min-w-0 flex-wrap items-center gap-1 text-[11px] text-gardens-txs"
          data-testid="inbox-cue"
          aria-live="polite"
          title={`${cue.needYou} need you now${cue.overdue ? ` · ${cue.overdue} overdue` : ''}${cue.dueSoon ? ` · ${cue.dueSoon} due soon` : ''}`}
        >
          <AlarmClock className="h-3 w-3 shrink-0 text-gardens-tx" aria-hidden />
          <b className="text-gardens-tx tabular-nums">{cue.needYou}</b>
          {cue.overdue > 0 && <b className="whitespace-nowrap text-gardens-sem-red tabular-nums">· {cue.overdue} late</b>}
          {cue.dueSoon > 0 && <b className="whitespace-nowrap text-gardens-sem-amber tabular-nums">· {cue.dueSoon} soon</b>}
        </span>
      )}
      </div>
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 pb-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" data-testid="inbox-scope-links">
          {priority && (
            <InboxFilterPill
              label={`Priority ${priority.count}`}
              selected={priority.on}
              onClick={() => priority.onToggle(!priority.on)}
              className="font-semibold"
            />
          )}
          {([
            ['all', 'All'],
            ['unlinked', 'Unlinked'],
            ['hidden', 'Spam & auto'],
          ] as const).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => { priority?.onToggle(false); onListFilterChange(v); }}
              className={cn('inline-flex min-h-11 items-center whitespace-nowrap hover:underline lg:min-h-7', !priority?.on && listFilter === v ? 'font-semibold text-gardens-acc-dk' : 'text-gardens-txs')}
            >
              {l}
            </button>
          ))}
        </div>
        <span
          className="flex shrink-0 items-center gap-1 border-l pl-2"
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
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-gardens-grn/30 lg:h-8 lg:w-8"
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

      <div className={'relative shrink-0 mb-2'}>
        <Search className={'h-3.5 w-3.5 absolute top-1/2 -translate-y-1/2 left-3 text-gardens-txs pointer-events-none'} />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-7 min-[1440px]:h-8 pl-8 pr-3 text-[13px] rounded-lg border border-gardens-bdr bg-white text-gardens-tx placeholder:text-gardens-txs focus:outline-none focus:ring-2 focus:ring-gardens-grn/30 focus:border-gardens-grn"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto scrollbar-hide">
        {priority?.on ? (
          priority.content
        ) : isLoading ? (
          <InboxListSkeleton label="Loading customers" />
        ) : isError ? (
          <div className="py-3 px-2 flex items-center justify-center gap-2 text-gardens-txs">
            <Users className="h-4 w-4 text-gardens-txm" />
            <p className="text-xs m-0">Unable to load customers</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-3 px-2 flex items-center justify-center gap-2 text-gardens-txs">
            <Users className="h-4 w-4 text-gardens-txm" />
            <p className="text-xs m-0">No linked customers or unlinked threads found</p>
          </div>
        ) : (
          <div className={'divide-y divide-gardens-bdr'}>
            {sortedRows.map((row) => {
              const key = customerThreadRowStableKey(row);
              const selected = customersSelectionsEqual(customersSelection, customersSelectionFromRow(row));
              const isCustomer =
                row.kind === 'linked' && customerFlagByPersonId?.get(row.personId) === true;
              const isUnread = row.unreadCount > 0;
              const storedPreview = (row.latestSubject || row.latestPreview || '').trim();
              const fetchedPreview = fetchedPreviews?.get(row.latestConversationId)?.trim()
                || row.conversationIds.map((id) => fetchedPreviews?.get(id)?.trim()).find(Boolean);
              const previewFirst = (storedPreview && storedPreview !== 'No preview' ? storedPreview : '') || fetchedPreview || 'No preview';
              const rowAction = actionByKey.get(key);
              const isCold = coldKeys.has(key);
              // Full action pill on every needs-us row (v13); waiting rows get the grey chip.
              const actionKind = rowAction?.action.kind;
              const pillVisible = !!rowAction && !isCold && actionKind !== 'waiting' && actionKind !== 'none';
              const ball = rowBall(row, bucketAndAgingByConversationId);
              const explanation = rowAction && !isCold ? rowExplanation(rowAction, ball) : '';
                const chip = row.kind === 'unlinked' ? 'Unlinked' : inquiryRowLabel({ isCustomer, enquiry: row.kind === 'linked' ? enquiryByPersonId?.get(row.personId) : undefined });
                return (
                  <div key={key} ref={selected ? selectedRowRef : undefined} className={cn('relative group', isCold && 'opacity-60')}>
                    <InboxRow
                      title={rowTitle(row)}
                      initials={rowInitials(row)}
                      source={chip ?? ''}
                      time={formatConversationTimestamp(row.latestMessageAt)}
                      preview={previewFirst}
                      hasPreview={previewFirst !== 'No preview'}
                      isUnread={isUnread}
                      selected={selected}
                      tone={pillVisible && rowAction ? (rowAction.timer?.tone === 'over' ? 'red' : rowAction.action.tone === 'red' ? 'red' : 'amber') : actionKind === 'waiting' && !isCold ? 'blue' : 'none'}
                      onSelect={() => onSelectCustomersRow(row)}
                      pill={pillVisible && actionKind && rowAction ? (
                        <ActionChip
                          kind={actionKind}
                          label={rowAction.action.label}
                          tone={rowAction.timer?.tone === 'over' ? 'red' : rowAction.action.tone}
                          solid={selected}
                          expanded
                          className="shrink-0 h-6 text-[11px] pl-2 pr-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!selected) onSelectCustomersRow(row);
                            const target = viewerPrimary(rowPrimary(rowAction), canSeeMoney)?.target;
                            if (target && target !== 'composer') navigate(target);
                          }}
                        />
                      ) : actionKind === 'waiting' && !isCold && rowAction ? (
                        <WaitingChip label={rowAction.action.label || 'Waiting on them'} className="shrink-0 h-6 text-[11px] pl-2 pr-2" />
                      ) : null}
                      meta={((rowAction?.timer && !isCold) || (ball && !isCold) || row.lastDirection) ? (
                        <>
                          {rowAction?.timer && !isCold && <ReplyTimer timer={rowAction.timer} className="text-[11px] shrink-0 [&_svg]:h-3 [&_svg]:w-3" />}
                          {ball && !isCold && (
                            <span className={cn('shrink-0', ball.side === 'us' ? 'text-amber-800 font-semibold' : 'text-gardens-txs')}>
                              {rowAction?.timer && !isCold ? '· ' : ''}{ball.side === 'us' ? 'on us' : 'on customer'} {Math.floor(ball.sinceMs / 86400000)}d
                            </span>
                          )}
                          {row.lastDirection && (
                            <span className="truncate min-w-0">
                              {(rowAction?.timer && !isCold) || (ball && !isCold) ? '· ' : ''}
                              {row.lastIsYopaCall ? 'YOPA call (not a reply)' : `last ${row.lastDirection === 'in' ? 'in' : 'out'} ${CHANNEL_WORD[row.lastChannel] ?? row.lastChannel}`}
                            </span>
                          )}
                        </>
                      ) : null}
                      metaTitle={explanation || undefined}
                    />
                  </div>
                );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
