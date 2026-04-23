import React from 'react';
import { Mail, MessageCircle, Phone, Search, Eye, EyeOff, Users, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatConversationTimestamp } from '@/modules/inbox/utils/conversationUtils';
import type { CustomerThreadRow, CustomersSelection } from '@/modules/inbox/types/inbox.types';
import { customerThreadRowStableKey, customersSelectionsEqual, customersSelectionFromRow } from '@/modules/inbox/types/inbox.types';
import { InboxStatusBadge } from '@/modules/inbox/components/InboxStatusBadge';

export type CustomerListFilter = 'all' | 'unread' | 'urgent' | 'unlinked';
export type CustomerChannelFilter = 'all' | 'email' | 'sms' | 'whatsapp';

const FILTER_BUTTONS: { value: CustomerListFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'unlinked', label: 'Unlinked' },
];

const CHANNEL_OPTIONS: { value: CustomerChannelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

function ChannelIndicator({ channel }: { channel: 'email' | 'sms' | 'whatsapp' }) {
  const Icon = channel === 'email' ? Mail : channel === 'sms' ? Phone : MessageCircle;
  const label = channel === 'sms' ? 'SMS' : channel.charAt(0).toUpperCase() + channel.slice(1);
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] bg-slate-100 text-slate-600">
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
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
  allRowsSelected: boolean;
  canSelectAllRows: boolean;
  onToggleRowSelection: (row: CustomerThreadRow) => void;
  onToggleSelectAllRows: () => void;
  onDeleteClick: () => void;
  showDeleteButton: boolean;
  deleteDisabled: boolean;
  deleteLabel: string;
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
  allRowsSelected,
  canSelectAllRows,
  onToggleRowSelection,
  onToggleSelectAllRows,
  onDeleteClick,
  showDeleteButton,
  deleteDisabled,
  deleteLabel,
}) => {
  const isMarkingRead = selectedHasUnread;

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allRowsSelected}
            disabled={!rows.length || !canSelectAllRows}
            aria-label="Select all visible customer rows"
            className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500/40 disabled:opacity-50"
            onChange={onToggleSelectAllRows}
          />
          <h2 className="text-sm font-semibold text-slate-800">Customers</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {showDeleteButton && (
            <button
              type="button"
              onClick={onDeleteClick}
              disabled={deleteDisabled}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              <span>{deleteLabel}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleReadUnreadClick}
            disabled={toggleReadUnreadDisabled}
            className="inline-flex items-center rounded-md bg-emerald-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none"
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
        <div className="flex items-center gap-1.5 flex-nowrap min-w-0 overflow-hidden">
          {FILTER_BUTTONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onListFilterChange(value)}
              className={cn(
                'inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium border',
                listFilter === value
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={channelFilter}
          onChange={(e) => onChannelFilterChange(e.target.value as CustomerChannelFilter)}
          className="shrink-0 h-6 rounded-md border border-slate-200 bg-white pl-2 pr-5 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
        >
          {CHANNEL_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative shrink-0 mb-2">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-8 pl-8 pr-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto scrollbar-hide px-0.5">
        {isLoading ? (
          <div className="p-6 text-center text-slate-500">
            <Users className="h-9 w-9 mx-auto mb-2 text-slate-300" />
            <p className="text-xs">Loading customers...</p>
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-slate-500">
            <Users className="h-9 w-9 mx-auto mb-2 text-slate-300" />
            <p className="text-xs">Unable to load customers</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <Users className="h-9 w-9 mx-auto mb-2 text-slate-300" />
            <p className="text-xs">No linked customers or unlinked threads found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => {
              const key = customerThreadRowStableKey(row);
              const selected = customersSelectionsEqual(customersSelection, customersSelectionFromRow(row));
              const isChecked = selectedRowKeys.includes(key);
              return (
                <div key={key} className="relative group">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    aria-label={`Select customer row ${rowTitle(row)}`}
                    className={cn(
                      'absolute left-2 top-3 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500/40 z-10',
                      isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                    )}
                    onChange={() => onToggleRowSelection(row)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectCustomersRow(row)}
                    className={cn(
                      'w-full text-left py-2 px-2 pl-8 rounded-lg transition-colors flex items-start gap-2',
                      selected ? 'bg-emerald-50/90' : 'bg-white hover:bg-slate-50/80'
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center shrink-0">
                      {rowInitials(row)}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5 overflow-hidden">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-[13px] text-slate-900 truncate">{rowTitle(row)}</span>
                        <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                          {formatConversationTimestamp(row.latestMessageAt)}
                        </span>
                      </div>
                      <div className="mt-1 min-w-0 overflow-hidden">
                        <p className="text-[12px] text-slate-600 truncate leading-snug">
                          {row.latestPreview ?? 'No preview'}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {row.channels.map((channel) => (
                          <ChannelIndicator key={channel} channel={channel} />
                        ))}
                        {row.kind === 'unlinked' && (
                          <InboxStatusBadge variant="unlinked">Unlinked</InboxStatusBadge>
                        )}
                        {row.hasUnread && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-medium">
                            Unread
                          </span>
                        )}
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
