import React from 'react';
import { Bell, Check, Link2, Receipt, Send, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { VerbPill } from '@/modules/today/ui';
import { gbp2 } from '@/modules/today/uiHelpers';
import {
  QUEUE_FILTERS,
  queueCounts,
  rowsForFilter,
  type FinanceQueueRow,
  type QueueChip,
  type QueueFilter,
} from '../queue';

const CHIP_ICON: Record<QueueChip, LucideIcon> = {
  Match: Link2,
  Chase: Bell,
  Record: Receipt,
  Fix: Wrench,
  Send: Send,
  Done: Check,
};

export const FinanceQueue: React.FC<{
  rows: FinanceQueueRow[];
  filter: QueueFilter;
  onFilter: (filter: QueueFilter) => void;
  showInvoices: boolean;
  onToggleInvoices: () => void;
  onOpen: (row: FinanceQueueRow) => void;
  onAction: (row: FinanceQueueRow) => void;
  focusOrderId?: string | null;
  invoices?: React.ReactNode;
}> = ({ rows, filter, onFilter, showInvoices, onToggleInvoices, onOpen, onAction, focusOrderId, invoices }) => {
  const counts = queueCounts(rows);
  const shown = rowsForFilter(rows, filter);

  return (
    <section className="min-w-0 rounded-[10px] border border-gardens-bdr bg-gardens-surf" data-testid="finance-queue">
      <div className="flex min-w-0 gap-1 overflow-x-auto p-2" role="tablist" aria-label="Finance queue">
        {QUEUE_FILTERS.map((item) => {
          const on = !showInvoices && filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={`queue-filter-${item.id}`}
              onClick={() => onFilter(item.id)}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap',
                on ? 'border-gardens-acc bg-gardens-acc-lt text-gardens-acc-dk' : 'border-gardens-bdr text-gardens-txs',
              )}
            >
              {item.label}
              <span className="tabular-nums">{counts[item.id]}</span>
            </button>
          );
        })}
        <button
          type="button"
          data-testid="finance-invoices-link"
          aria-pressed={showInvoices}
          onClick={onToggleInvoices}
          className={cn(
            'inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[13px] font-semibold',
            showInvoices ? 'border-gardens-acc bg-gardens-acc-lt text-gardens-acc-dk' : 'border-transparent text-gardens-acc-dk underline',
          )}
        >
          Invoices
        </button>
      </div>

      {showInvoices ? invoices : (
        <div className="min-w-0 overflow-x-auto border-t border-gardens-bdr">
          <div className="min-w-[720px]" role="table" aria-label="Finance queue">
            <div className="grid grid-cols-[7.5rem_minmax(0,1.1fr)_minmax(0,1.3fr)_6.5rem_6.5rem_9.5rem] gap-2 px-2 py-1.5 text-[13px] font-semibold text-gardens-txs" role="row">
              <span>Action</span>
              <span>Customer</span>
              <span>What</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Age</span>
              <span className="text-right"> </span>
            </div>
            <ul className="m-0 list-none divide-y divide-gardens-bdr p-0" data-testid="finance-queue-rows">
              {shown.map((row) => {
                const Icon = CHIP_ICON[row.chip];
                return (
                  <li
                    key={row.id}
                    role="row"
                    tabIndex={0}
                    data-testid="finance-queue-row"
                    data-chip={row.chip}
                    className={cn('cursor-pointer px-2', focusOrderId && row.orderId === focusOrderId && 'bg-gardens-acc-lt')}
                    onClick={() => onOpen(row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(row);
                      }
                    }}
                  >
                    <div className="grid grid-cols-[7.5rem_minmax(0,1.1fr)_minmax(0,1.3fr)_6.5rem_6.5rem_9.5rem] items-center gap-2 py-2">
                      <VerbPill colour={row.colour}>
                        <Icon className="mr-1 h-3.5 w-3.5" aria-hidden />
                        {row.chip}
                      </VerbPill>
                      <span className="min-w-0 text-left">
                        <span className="block truncate font-head text-[14px] font-semibold text-gardens-tx">{row.name}</span>
                        {row.ref && <span className="block truncate text-[13px] text-gardens-txs">{row.ref}</span>}
                      </span>
                      <span className="min-w-0 truncate text-[13px] text-gardens-tx">{row.what}</span>
                      <span className="text-right text-[13px] font-semibold tabular-nums">{gbp2(row.amount)}</span>
                      <span className={cn('text-right text-[13px] tabular-nums', row.overdue ? 'font-semibold text-gardens-na-red' : 'text-gardens-txs')}>
                        {row.ageLabel}
                      </span>
                      <span className="text-right">
                        <button
                          type="button"
                          className="inline-flex h-8 items-center rounded-md bg-gardens-acc px-2.5 text-[13px] font-semibold text-white"
                          onClick={(e) => { e.stopPropagation(); onAction(row); }}
                        >
                          {row.button}
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
              {shown.length === 0 && (
                <li className="px-2 py-4 text-[13px] text-gardens-txs">Nothing in this view.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
