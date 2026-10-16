import React from 'react';
import { ListFilter, Plus, Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import type { OrderKpi } from '../utils/orderKpis';
import type { OrdersGroupBy } from '../utils/orderGroups';
import { ORDERS_GROUP_OPTIONS } from '../utils/orderGroups';
import type { DefaultSortMode } from '../utils/orderDefaultSort';
import type { OrdersTab } from '../utils/orderGrouping';

const SORTS: { value: DefaultSortMode; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'newest', label: 'Newest first' },
  { value: 'value', label: 'Highest value' },
  { value: 'ref', label: 'Ref' },
  { value: 'eta', label: 'Supplier ETA' },
];

const control = 'inline-flex min-h-11 items-center lg:h-8 lg:min-h-0';

export interface OrdersToolbarTab {
  value: OrdersTab;
  label: string;
  count: number;
}

export interface AttentionChip {
  key: OrderKpi;
  label: string;
  count: number;
  overdue: boolean;
  pressed: boolean;
}

export function OrdersToolbar({
  tabs,
  moreTabs,
  activeTab,
  kpiActive,
  onTab,
  search,
  onSearch,
  groupBy,
  onGroup,
  sortMode,
  onSort,
  unassignedOnly,
  unassignedCount,
  onUnassigned,
  includeArchived,
  onArchived,
  onColumns,
  onNewOrder,
  attention,
  onAttention,
  supplierFilters,
  onSupplierFilter,
  extras,
}: {
  tabs: OrdersToolbarTab[];
  moreTabs: OrdersToolbarTab[];
  activeTab: OrdersTab;
  kpiActive: boolean;
  onTab: (tab: OrdersTab) => void;
  search: string;
  onSearch: (value: string) => void;
  groupBy: OrdersGroupBy;
  onGroup: (group: OrdersGroupBy) => void;
  sortMode: DefaultSortMode;
  onSort: (mode: DefaultSortMode) => void;
  unassignedOnly: boolean;
  unassignedCount: number;
  onUnassigned: (value: boolean) => void;
  includeArchived: boolean;
  onArchived: (value: boolean) => void;
  onColumns: () => void;
  onNewOrder: () => void;
  attention: AttentionChip[];
  onAttention: (key: OrderKpi) => void;
  supplierFilters: { value: string; on: boolean }[] | null;
  onSupplierFilter: (value: string) => void;
  extras?: React.ReactNode;
}) {
  const groupLabel = ORDERS_GROUP_OPTIONS.find((option) => option.value === groupBy)?.label.toLowerCase() ?? 'priority';
  const showSecond = attention.length > 0 || !!extras;
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="orders-toolbar">
      <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-x-4 gap-y-2 lg:flex-nowrap">
        <div className="flex min-w-0 flex-wrap items-center" role="tablist" aria-label="Order status">
          {tabs.map((tab) => {
            const on = !kpiActive && activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={on}
                data-testid={`orders-tab-${tab.value}`}
                onClick={() => onTab(tab.value)}
                className={cn(
                  control,
                  'shrink-0 px-3 text-[14px]',
                  on ? 'font-bold text-gardens-tx shadow-[inset_0_-2px_0_var(--g-acc)]' : 'text-gardens-txs',
                )}
              >
                {tab.label}
                <span className="ml-1 font-semibold tabular-nums text-gardens-txm-aa">{tab.count}</span>
              </button>
            );
          })}
          {moreTabs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={cn(control, 'shrink-0 px-2.5 text-[14px] text-gardens-txm')} data-testid="orders-more">
                  More ▾
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {moreTabs.map((tab) => (
                  <DropdownMenuItem key={tab.value} onSelect={() => onTab(tab.value)} className="min-h-11 justify-between lg:min-h-0">
                    <span>{tab.label}</span>
                    <span className="tabular-nums text-gardens-txm-aa">{tab.count}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:ml-auto lg:w-auto lg:flex-nowrap">
          <div className="relative min-w-0 w-full sm:w-[220px]">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gardens-txm" />
            <Input
              placeholder="Search orders"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              className="h-11 border-gardens-bdr bg-white pl-8 text-[13px] placeholder:text-gardens-txm lg:h-8"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-testid="orders-view"
                className={cn(control, 'shrink-0 gap-1.5 rounded-lg border border-gardens-bdr bg-white px-2.5 text-[13px]')}
              >
                <ListFilter className="h-3.5 w-3.5" aria-hidden />
                Grouped by {groupLabel} ▾
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-gardens-txs">Group by</DropdownMenuLabel>
              {ORDERS_GROUP_OPTIONS.map((option) => (
                <DropdownMenuItem key={option.value} onSelect={() => onGroup(option.value)} className="min-h-11 justify-between lg:min-h-0">
                  {option.label}
                  {groupBy === option.value && <span aria-hidden>✓</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-gardens-txs">Sort</DropdownMenuLabel>
              {SORTS.map((option) => (
                <DropdownMenuItem key={option.value} onSelect={() => onSort(option.value)} className="min-h-11 justify-between lg:min-h-0" data-testid={`orders-sort-${option.value}`}>
                  {option.label}
                  {sortMode === option.value && <span aria-hidden>✓</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-gardens-txs">Show</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={unassignedOnly}
                onCheckedChange={(checked) => onUnassigned(checked === true)}
                onSelect={(event) => event.preventDefault()}
                className="min-h-11 lg:min-h-0"
                data-testid="orders-unassigned"
              >
                <span className="flex w-full items-center justify-between gap-3">
                  Unassigned only
                  <span className="tabular-nums text-gardens-txm-aa">{unassignedCount}</span>
                </span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={includeArchived}
                onCheckedChange={(checked) => onArchived(checked === true)}
                onSelect={(event) => event.preventDefault()}
                className="min-h-11 lg:min-h-0"
                data-testid="orders-archived"
              >
                Include archived
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem onSelect={onColumns} className="min-h-11 lg:min-h-0" data-testid="orders-columns">
                Columns…
              </DropdownMenuItem>
              {supplierFilters && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-gardens-txs">Supplier</DropdownMenuLabel>
                  {supplierFilters.map((filter) => (
                    <DropdownMenuCheckboxItem
                      key={filter.value}
                      checked={filter.on}
                      onCheckedChange={() => onSupplierFilter(filter.value)}
                      onSelect={(event) => event.preventDefault()}
                      className="min-h-11 lg:min-h-0"
                    >
                      {filter.value}
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            data-testid="orders-new"
            onClick={onNewOrder}
            className={cn(control, 'shrink-0 gap-1 rounded-lg bg-gardens-acc px-3.5 text-[13px] font-semibold text-white hover:bg-gardens-acc-dk')}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New order
          </button>
        </div>
      </div>
      {showSecond && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="orders-attention">
          {attention.length > 0 && <span className="mr-1 text-[12px] text-gardens-txm-aa">Needs attention</span>}
          {attention.map((chip) => (
            <button
              key={chip.key}
              type="button"
              data-testid={`orders-kpi-${chip.key}`}
              aria-pressed={chip.pressed}
              onClick={() => onAttention(chip.key)}
              className={cn(
                'inline-flex h-7 min-h-11 items-center gap-1.5 rounded-full border px-[11px] text-[12.5px] lg:min-h-0',
                chip.pressed
                  ? 'border-gardens-acc bg-gardens-acc-lt font-bold'
                  : 'border-gardens-bdr bg-transparent hover:bg-white',
              )}
            >
              {chip.label}
              <span className={cn('font-bold tabular-nums', chip.overdue ? 'text-gardens-na-red' : 'text-gardens-tx')}>{chip.count}</span>
              {chip.pressed && <span className="text-gardens-acc-dk">✕</span>}
            </button>
          ))}
          {extras}
        </div>
      )}
    </div>
  );
}
