import React, { useState } from 'react';
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

const PAGE = 50;
const COLS = 'lg:grid-cols-[7.75rem_minmax(13rem,1.2fr)_minmax(12rem,1.3fr)_6.25rem_5.5rem_9.25rem]';

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
  const [limit, setLimit] = useState(PAGE);
  const [limitFilter, setLimitFilter] = useState(filter);
  if (limitFilter !== filter) {
    setLimitFilter(filter);
    setLimit(PAGE);
  }
  const visible = shown.slice(0, limitFilter === filter ? limit : PAGE);

  return (
    <section className="min-w-0 rounded-lg border border-gardens-bdr bg-gardens-surf" data-testid="finance-queue">
      {/* Shell padding is p-3 / sm:p-4 / min-[1440px]:p-6. Negative top covers that band once the bar sticks, so rows cannot show through it. */}
      <div
        className="sticky -top-3 z-20 border-b border-gardens-bdr bg-gardens-surf shadow-[0_4px_0_0_var(--g-surf)] before:pointer-events-none before:absolute before:inset-x-0 before:-top-1 before:h-1 before:bg-gardens-surf before:content-[''] after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-1 after:h-1 after:bg-gardens-surf after:content-[''] sm:-top-4 min-[1440px]:-top-6"
        data-testid="finance-queue-filters"
      >
      <div className="p-1.5 md:hidden">
        <label className="sr-only" htmlFor="finance-queue-picker">Finance queue</label>
        <select
          id="finance-queue-picker"
          data-testid="finance-queue-select"
          className="h-11 w-full rounded-full border border-gardens-bdr bg-gardens-surf2 px-3 text-xs font-semibold text-gardens-tx"
          value={showInvoices ? 'invoices' : filter}
          onChange={(e) => {
            const next = e.target.value;
            if (next === 'invoices') {
              if (!showInvoices) onToggleInvoices();
              return;
            }
            onFilter(next as QueueFilter);
          }}
        >
          {QUEUE_FILTERS.map((item) => (
            <option key={item.id} value={item.id}>{item.label} {counts[item.id]}</option>
          ))}
          <option value="invoices">Invoices</option>
        </select>
      </div>
      <div className="hidden min-w-0 flex-wrap gap-1 p-1.5 md:flex" role="tablist" aria-label="Finance queue">
        {QUEUE_FILTERS.map((item) => {
          const on = !showInvoices && filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-pressed={on}
              data-testid={`queue-filter-${item.id}`}
              onClick={() => onFilter(item.id)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold whitespace-nowrap',
                on ? 'border-gardens-acc bg-gardens-acc-lt text-gardens-acc-dk' : 'border-gardens-bdr bg-gardens-surf2 text-gardens-txs',
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
            'inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold',
            showInvoices ? 'border-gardens-acc bg-gardens-acc-lt text-gardens-acc-dk' : 'border-transparent text-gardens-acc-dk underline',
          )}
        >
          Invoices
        </button>
      </div>
      {!showInvoices && (
        <div className={cn('hidden gap-2 px-2 pb-1.5 text-[13px] font-semibold text-gardens-txs lg:grid', COLS)} role="row" data-testid="finance-queue-head">
          <span>Action</span>
          <span>Customer</span>
          <span>What</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Age</span>
          <span className="text-right"> </span>
        </div>
      )}
      </div>

      {showInvoices ? invoices : (
        <div className="min-w-0" role="table" aria-label="Finance queue">
          <ul className="m-0 list-none divide-y divide-gardens-bdr px-0 pb-0 pt-2" data-testid="finance-queue-rows">
            {visible.map((row) => {
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
                  <div className={cn('flex flex-col gap-1 py-2.5 lg:grid lg:items-center lg:gap-2 lg:py-2', COLS)}>
                    <div>
                      <VerbPill colour={row.colour} className="w-[6.5rem]">
                        <Icon className="mr-1 h-3.5 w-3.5" aria-hidden />
                        {row.chip}
                      </VerbPill>
                    </div>
                    <span className="min-w-0 text-left">
                      <span className="block font-head text-[14px] font-semibold text-gardens-tx lg:truncate">{row.name}</span>
                      {row.ref && <span className="block text-[13px] text-gardens-txs lg:truncate">{row.ref}</span>}
                    </span>
                    <span className="min-w-0 text-[13px] text-gardens-tx lg:truncate">{row.what}</span>
                    <div className="flex items-baseline justify-between gap-3 lg:contents">
                      <span className="text-[13px] font-semibold tabular-nums lg:text-right">{gbp2(row.amount)}</span>
                      <span className={cn('text-[13px] tabular-nums lg:text-right', row.overdue ? 'font-semibold text-gardens-na-red' : 'text-gardens-txs')}>
                        {row.ageLabel}
                      </span>
                    </div>
                    <span className="lg:text-right">
                      <button
                        type="button"
                        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-gardens-acc px-2.5 text-[13px] font-semibold text-white lg:h-8 lg:w-auto"
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
          {shown.length > visible.length && (
            <div className="border-t border-gardens-bdr p-2">
              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-gardens-bdr text-[13px] font-semibold text-gardens-tx lg:h-8"
                data-testid="finance-queue-more"
                onClick={() => setLimit((n) => n + PAGE)}
              >
                Show more
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
