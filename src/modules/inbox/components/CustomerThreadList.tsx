import React from 'react';
import { Search, Eye, EyeOff, Trash2, Users } from 'lucide-react';
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
import { useMutedSenders } from '@/modules/inbox/hooks/useMutedSenders';
import { useOrganization } from '@/shared/context/OrganizationContext';

export type CustomerListFilter = 'all' | 'unread' | 'awaiting' | 'urgent' | 'unlinked' | 'stuck' | 'hidden';
export type CustomerChannelFilter = 'all' | 'email' | 'sms' | 'whatsapp';

const FILTER_BUTTONS: { value: CustomerListFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'awaiting', label: 'Awaiting reply' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'unlinked', label: 'Unlinked' },
  { value: 'stuck', label: 'Stuck' },
];

const CHANNEL_OPTIONS: { value: CustomerChannelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
];
const MAX_BULK_SELECTION = 50;

type BucketAging = { bucket: InboxBucket; aging: AgingInfo | null };

/**
 * Reply-clock badge input for a grouped row: the worst (oldest) awaiting-reply
 * aging among the group's member conversations. Gated on `oldestAwaitingReplyAt`
 * so the badge hides entirely when nothing in the group awaits a reply; the map
 * entry supplies the member's own bucket SLA (`ball.side === 'us'` ⇔ awaiting,
 * and the max `sinceMs` corresponds to `oldestAwaitingReplyAt`).
 */
function groupAwaitingAging(
  row: CustomerThreadRow,
  bucketAndAgingByConversationId: Map<string, BucketAging>
): BucketAging | null {
  if (!row.oldestAwaitingReplyAt) return null;
  let worst: BucketAging | null = null;
  for (const id of row.conversationIds) {
    const entry = bucketAndAgingByConversationId.get(id);
    if (!entry?.aging || entry.aging.ball.side !== 'us') continue;
    if (!worst || entry.aging.ball.sinceMs > worst.aging!.ball.sinceMs) worst = entry;
  }
  return worst;
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
  onToggleReadUnreadClick: () => void;
  toggleReadUnreadDisabled: boolean;
  selectedHasUnread: boolean;
  selectedRowKeys: string[];
  onToggleRowSelection: (row: CustomerThreadRow) => void;
  onToggleSelectAllRows: () => void;
  onDeleteClick: () => void;
  /** Bucket + aging per conversation, computed once at the page level (same map as InboxConversationList). */
  bucketAndAgingByConversationId: Map<string, BucketAging>;
  /** Count of muted (hidden) groups; drives the trailing "Hidden" pill, which only renders when > 0. */
  mutedCount: number;
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
  onToggleReadUnreadClick,
  toggleReadUnreadDisabled,
  selectedHasUnread,
  selectedRowKeys,
  onToggleRowSelection,
  onToggleSelectAllRows,
  onDeleteClick,
  bucketAndAgingByConversationId,
  mutedCount,
}) => {
  const { data: customerScores } = useCustomerScores();
  const scoreByPersonId = new Map((customerScores ?? []).map((s) => [s.id, s]));
  const { organizationId } = useOrganization();
  const { unmute } = useMutedSenders(organizationId);

  // "Hidden" renders last and only once something is muted (keeps the default UI
  // clean); also kept while the filter is active so unmuting the last row doesn't
  // strand the selection on an invisible pill.
  const filterButtons =
    mutedCount > 0 || listFilter === 'hidden'
      ? [...FILTER_BUTTONS, { value: 'hidden' as const, label: `Hidden (${mutedCount})` }]
      : FILTER_BUTTONS;

  const isMarkingRead = selectedHasUnread;
  const selectedCount = selectedRowKeys.length;
  const visibleRowKeys = rows.map((row) => customerThreadRowStableKey(row));
  const visibleSelectedCount = visibleRowKeys.filter((key) => selectedRowKeys.includes(key)).length;
  const allVisibleSelected = visibleRowKeys.length > 0 && visibleSelectedCount === visibleRowKeys.length;
  const canSelectMore = selectedCount < MAX_BULK_SELECTION;
  const canSelectAllVisible = canSelectMore || allVisibleSelected;

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            disabled={!visibleRowKeys.length || !canSelectAllVisible}
            aria-label="Select all visible customer rows"
            title={
              !canSelectAllVisible && !allVisibleSelected
                ? `Selection limit reached (${MAX_BULK_SELECTION})`
                : 'Select all visible customer rows'
            }
            className="h-4 w-4 rounded border-gardens-bdr text-gardens-acc focus:ring-gardens-acc/40 disabled:opacity-50"
            onChange={onToggleSelectAllRows}
          />
          <h2 className="text-sm font-semibold text-gardens-tx">Customers</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onDeleteClick}
              className="inline-flex items-center rounded-md border border-gardens-bdr bg-gardens-surf2 px-2 py-1 text-[11px] font-medium text-gardens-txs hover:bg-gardens-page"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              <span>Delete ({selectedCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleReadUnreadClick}
            disabled={toggleReadUnreadDisabled}
            className="inline-flex items-center rounded-md bg-gardens-grn-dk px-2 py-1 text-[11px] font-medium text-white hover:bg-gardens-grn-dk disabled:opacity-50 disabled:pointer-events-none"
          >
            {isMarkingRead ? (
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

      <div className="flex items-center gap-2 shrink-0 pb-2 min-w-0">
        <InboxFilterPillRow
          options={filterButtons}
          value={listFilter}
          onChange={onListFilterChange}
        />
        <select
          value={channelFilter}
          onChange={(e) => onChannelFilterChange(e.target.value as CustomerChannelFilter)}
          className="shrink-0 h-6 rounded-md border border-gardens-bdr bg-white pl-2 pr-5 text-[11px] font-medium text-gardens-tx focus:outline-none focus:ring-2 focus:ring-gardens-grn/30 focus:border-gardens-grn"
        >
          {CHANNEL_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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
          <div className="divide-y divide-slate-100">
            {rows.map((row) => {
              const key = customerThreadRowStableKey(row);
              const selected = customersSelectionsEqual(customersSelection, customersSelectionFromRow(row));
              const checked = selectedRowKeys.includes(key);
              const disableCheckbox = !checked && !canSelectMore;
              const score = row.kind === 'linked' ? scoreByPersonId.get(row.personId) : undefined;
              const isUnread = row.unreadCount > 0;
              const previewFirst = row.latestSubject || row.latestPreview || 'No preview';
              const awaitingAging = groupAwaitingAging(row, bucketAndAgingByConversationId);
              return (
                <div key={key} className="relative group">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disableCheckbox}
                    aria-label={`Select customer row ${rowTitle(row)}`}
                    className={cn(
                      'absolute left-2 top-3 h-4 w-4 rounded border-gardens-bdr text-gardens-acc focus:ring-gardens-acc/40 z-10',
                      checked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                      disableCheckbox && 'opacity-40',
                    )}
                    onChange={() => onToggleRowSelection(row)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectCustomersRow(row)}
                    className={cn(
                      'w-full text-left py-2 px-2 pl-8 rounded-lg transition-colors flex items-start gap-2',
                      selected ? 'bg-gardens-grn-lt/90' : 'bg-white hover:bg-gardens-page/80'
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-gardens-bdr text-gardens-tx text-[11px] font-semibold flex items-center justify-center shrink-0">
                      {rowInitials(row)}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5 overflow-hidden">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            'text-[13px] text-gardens-tx truncate',
                            isUnread ? 'font-bold' : 'font-semibold'
                          )}
                        >
                          {rowTitle(row)}
                        </span>
                        <span className="text-[11px] text-gardens-txs shrink-0 whitespace-nowrap">
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
                        {awaitingAging?.aging && (
                          <InboxAgingBadge bucket={awaitingAging.bucket} aging={awaitingAging.aging} />
                        )}
                        {score && (
                          <ScoreBadge score={score.score} band={score.band} breakdown={score.breakdown} />
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
