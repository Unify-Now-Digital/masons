import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { Search, Plus, Columns, ArrowUpDown } from 'lucide-react';
import { ORDER_KPI_LABEL, ORDER_KPI_HINT, kpiSummary, matchesKpi, type OrderKpi } from '../utils/orderKpis';
import type { DefaultSortMode } from '../utils/orderDefaultSort';
import { SortableOrdersTable } from "../components/SortableOrdersTable";
import { useOrderPaidMap } from "../hooks/useOrderPaidMap";
import { OrderDetailsSidebar } from "../components/OrderDetailsSidebar";
import { CreateOrderDrawer } from "../components/CreateOrderDrawer";
import { EditOrderDrawer } from "../components/EditOrderDrawer";
import { DeleteOrderDialog } from "../components/DeleteOrderDialog";
import { useOrdersList } from "@/modules/orders/hooks/useOrders";
import { formatStageLabel } from "@/modules/jobsPipeline";
import {
  ORDERS_AFTER_PAYMENT_TABS,
  type OrdersTab,
} from "../utils/orderGrouping";
import { transformOrdersForUI, type UIOrder } from "../utils/orderTransform";
import {
  FILTERABLE_COLUMN_IDS,
  FILTER_COLUMN_LABELS,
  type FilterableColumnId,
  buildFilterOptions,
  encodeFilterValues,
  filterParamName,
  matchesColumnFilters,
  parseColumnFilters,
} from "../utils/orderColumnFilters";
import type { Order } from "../types/orders.types";
import { ColumnsDialog } from '@/shared/tableViewPresets/components/ColumnsDialog';
import { usePresetsByModule } from '@/shared/tableViewPresets/hooks/useTableViewPresets';
import { applyPresetToState, getDefaultState, extractStateToConfig } from '@/shared/tableViewPresets/utils/columnState';
import { getColumnDefinitions } from '@/shared/tableViewPresets/config/defaultColumns';
import type { ColumnState } from '@/shared/tableViewPresets/types/tableViewPresets.types';

// r2: Enquired / Quoted are deals, not orders → they live in Pipeline (link in the toolbar).
// Status tabs follow the order life after the invoice: Invoiced → Confirmed → In production → Fixed → Complete | All · Unassigned.
const TABS: { value: OrdersTab; label: string }[] = [
  ...(['invoiced', ...ORDERS_AFTER_PAYMENT_TABS] as OrdersTab[]).map((stage) => ({ value: stage, label: formatStageLabel(stage as never) })),
  { value: 'all', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
];

export const OrdersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<OrdersTab>('confirmed');
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [newOrderPersonId, setNewOrderPersonId] = useState<string | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [kpi, setKpi] = useState<OrderKpi | null>(null);
  const [sortMode, setSortMode] = useState<DefaultSortMode>('stone');
  const [columnState, setColumnState] = useState<ColumnState>(() => getDefaultState('orders'));
  const columnStateInitializedRef = useRef(false);
  const loadedFromStorageRef = useRef(false);
  const { data: ordersData, isLoading, error } = useOrdersList({ includeArchived: showArchived });
  const [searchParams, setSearchParams] = useSearchParams();
  const columnFilters = useMemo(() => parseColumnFilters(searchParams), [searchParams]);
  const { data: presets } = usePresetsByModule('orders');

  // v2 (2026-10-14): secondary columns hidden by default; v1 saved 'all visible'.
  const STORAGE_KEY = 'orders.columns.v3'; // v3: Progress column on, empty Age (due_date) off

  // Load column state on mount: prefer localStorage (user's last session), else default preset
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { version?: number; columns?: { visibility?: Record<string, boolean>; order?: string[]; widths?: Record<string, number> } };
        if (parsed?.columns?.visibility && Array.isArray(parsed?.columns?.order)) {
          const config = { version: parsed.version ?? 1, columns: parsed.columns };
          const newState = applyPresetToState(config, 'orders');
          setColumnState(newState);
          loadedFromStorageRef.current = true;
        }
      }
    } catch {
      // Ignore parse errors or invalid data
    }
    columnStateInitializedRef.current = true;
  }, []);

  // Load default preset when presets are available, only if we did not restore from localStorage
  useEffect(() => {
    if (!presets) return;
    if (loadedFromStorageRef.current) return;
    const defaultPreset = presets.find(p => p.is_default);
    if (defaultPreset) {
      const newState = applyPresetToState(defaultPreset.config, 'orders');
      setColumnState(newState);
    }
  }, [presets]);

  // Persist column state to localStorage when it changes (after initial load)
  useEffect(() => {
    if (!columnStateInitializedRef.current) return;
    try {
      const config = extractStateToConfig(columnState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore persistence errors
    }
  }, [columnState]);

  // Transform orders from DB format to UI format
  const { data: paidMap } = useOrderPaidMap();
  const uiOrders = useMemo(() => {
    if (!ordersData) return [];
    return transformOrdersForUI(ordersData).map((o) => (paidMap ? { ...o, amountPaid: paidMap[o.id] ?? 0 } : o));
  }, [ordersData, paidMap]);

  // Option lists derive from ALL loaded rows (pre-scope) so they never self-narrow.
  const filterOptions = useMemo(() => buildFilterOptions(uiOrders), [uiOrders]);

  const activeFilterColumns = useMemo(
    () => FILTERABLE_COLUMN_IDS.filter((id) => (columnFilters[id]?.length ?? 0) > 0),
    [columnFilters]
  );

  const handleColumnFilterChange = (columnId: string, values: string[]) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const param = filterParamName(columnId as FilterableColumnId);
      if (values.length === 0) next.delete(param);
      else next.set(param, encodeFilterValues(values));
      return next;
    });
  };

  const handleOrderUpdate = (orderId: string, updates: Partial<Order>) => {
    console.log('Updating order:', orderId, updates);
    // The update is handled by TanStack Query, so we just need to close the sidebar
    setSelectedOrder(null);
  };

  const handleEditOrder = (order: UIOrder) => {
    // Find the original DB order by ID
    const dbOrder = ordersData?.find((o) => o.id === order.id);
    if (dbOrder) {
      setOrderToEdit(dbOrder);
      setEditDrawerOpen(true);
    }
  };

  const handleDeleteOrder = (order: UIOrder) => {
    // Find the original DB order by ID
    const dbOrder = ordersData?.find((o) => o.id === order.id);
    if (dbOrder) {
      setOrderToDelete(dbOrder);
      setDeleteDialogOpen(true);
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return Infinity;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isReadyForInstall = (o: UIOrder) =>
    o.stoneStatus === "In Stock";

  // Search + cemetery scope, tab-independent. Tab counts and the table rows both
  // derive from this one list so a tab's count always equals the rows it shows.
  const scopedOrders = useMemo(() => {
    if (!uiOrders) return [];
    const cemeteryFilter = searchParams.get('cemetery');
    const allowedByCemetery = cemeteryFilter
      ? new Set((ordersData ?? []).filter((o) => o.cemetery_id === cemeteryFilter).map((o) => o.id))
      : null;
    return uiOrders.filter(order => {
      const matchesSearch = searchQuery === "" ||
                           order.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (order.deceasedName && order.deceasedName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                           order.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCemetery = !allowedByCemetery || allowedByCemetery.has(order.id);
      return matchesSearch && matchesCemetery && matchesColumnFilters(order, columnFilters);
    });
  }, [uiOrders, ordersData, searchQuery, searchParams, columnFilters]);

  const tabCounts = useMemo(() => {
    const counts: Record<OrdersTab, number> = {
      enquired: 0, quoted: 0, invoiced: 0, confirmed: 0,
      in_production: 0, fixed: 0, complete: 0, unassigned: 0, all: 0,
    };
    for (const order of scopedOrders) {
      counts[order.group] += 1;
      counts.all += 1;
    }
    return counts;
  }, [scopedOrders]);

  const filteredOrders = useMemo(
    () => (kpi ? scopedOrders.filter((o) => matchesKpi(o, kpi))
      : activeTab === 'all' ? scopedOrders : scopedOrders.filter((o) => o.group === activeTab)),
    [scopedOrders, activeTab, kpi]
  );

  const kpis = useMemo(() => kpiSummary(scopedOrders), [scopedOrders]);
  const stats = useMemo(() => {
    if (!uiOrders) {
      return { total: 0, overdue: 0, readyForInstall: 0 };
    }
    return {
      total: uiOrders.length,
      overdue: uiOrders.filter(o => o.dueDate && getDaysUntilDue(o.dueDate) < 0).length,
      // Permit/proof gates removed (Oct 2026): ready = stone in stock.
      readyForInstall: uiOrders.filter(isReadyForInstall).length
    };
  }, [uiOrders]);

  // Deep-link: ?order=<id> → open that order in the sidebar
  useEffect(() => {
    const orderId = searchParams.get('order');
    if (!orderId || selectedOrder || !ordersData) return;
    const match = ordersData.find((o) => o.id === orderId);
    if (match) {
      setSelectedOrder(match);
    }
  }, [searchParams, selectedOrder, ordersData]);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-gardens-red-dk">
          Error loading orders: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  const hiddenColumnCount = Object.values(columnState.visibility).filter((v) => !v).length;

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* r2 (OMS pattern: Shopify / ShipStation / Linnworks): KPI strip = clickable saved filters,
          then ONE aligned toolbar — status tabs with counts · search · columns · sort · primary right. */}
      <h1 className="sr-only">Orders</h1>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide sm:grid sm:grid-cols-3 lg:grid-cols-5" data-testid="orders-kpis">
        {(Object.keys(ORDER_KPI_LABEL) as OrderKpi[]).map((k) => {
          const v = kpis[k];
          const on = kpi === k;
          const tone = v.count === 0 ? 'text-gardens-txm-aa' : k === 'stone' || k === 'balance' ? 'text-gardens-na-amber' : 'text-gardens-tx';
          return (
            <button key={k} type="button" data-testid={`orders-kpi-${k}`} aria-pressed={on} title={ORDER_KPI_HINT[k]}
              onClick={() => { setKpi(on ? null : k); if (!on) setActiveTab('all'); }}
              className={cn('flex shrink-0 min-w-[9.5rem] flex-col items-start gap-1 rounded-[10px] border px-3 py-2 text-left transition-colors',
                on ? 'border-gardens-acc bg-gardens-acc-lt' : 'border-gardens-bdr bg-gardens-surf hover:bg-gardens-page')}>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gardens-txs">{ORDER_KPI_LABEL[k]}</span>
              <span className="flex items-baseline gap-2">
                <span className={cn('font-head text-[22px] font-semibold leading-none tabular-nums', tone)}>{v.count}</span>
                <span className="text-[12px] text-gardens-txs tabular-nums">
                  {k === 'fixing' && v.count === 0 ? 'no dates recorded' : v.value > 0 ? `£${Math.round(v.value).toLocaleString('en-GB')}${k === 'balance' ? ' to collect' : ''}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gardens-bdr pb-2 min-w-0" data-testid="orders-toolbar">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-nowrap min-w-0 max-w-full" role="tablist" aria-label="Order status">
          {TABS.map((tab, i) => {
            const count = tabCounts[tab.value];
            const on = activeTab === tab.value && !kpi;
            return (
              <React.Fragment key={tab.value}>
                {i === TABS.length - 2 && <span aria-hidden className="mx-1 h-4 w-px bg-gardens-bdr shrink-0" />}
                <button type="button" role="tab" aria-selected={on}
                  onClick={() => { setKpi(null); setActiveTab(tab.value); }}
                  className={cn('shrink-0 h-8 px-3 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors',
                    on ? 'bg-gardens-acc text-white' : 'text-gardens-txs hover:bg-gardens-page')}>
                  {tab.label}<span className={cn('ml-1 tabular-nums', on ? 'text-white/90' : count ? 'text-gardens-tx' : 'text-gardens-txm-aa')}>{count}</span>
                </button>
              </React.Fragment>
            );
          })}
          <Link to="/dashboard/inquiries" className="shrink-0 ml-1 text-[12px] text-gardens-txs underline-offset-2 hover:underline whitespace-nowrap"
            title="Enquired and Quoted are deals, not orders: they live in Pipeline">
            {tabCounts.enquired + tabCounts.quoted} enquired / quoted → Pipeline
          </Link>
        </div>
        <div className="flex items-center gap-2 ml-auto min-w-0 flex-1 sm:flex-none">
          <div className="relative flex-1 sm:w-56 min-w-[120px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-gardens-txm pointer-events-none" />
            <Input placeholder="Search name, ref, deceased" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-[13px] border-gardens-bdr bg-gardens-surf2 placeholder:text-gardens-txm" />
          </div>
          <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => setColumnsDialogOpen(true)} title="Columns and column filters">
            <Columns className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Columns{hiddenColumnCount > 0 && <span className="ml-1 text-gardens-txm-aa font-normal">· {hiddenColumnCount} hidden</span>}</span>
          </Button>
          <label className="shrink-0 flex items-center gap-1 text-[12px] text-gardens-txs">
            <ArrowUpDown className="hidden sm:block h-4 w-4" aria-hidden /><span className="sr-only">Sort</span>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as DefaultSortMode)} data-testid="orders-sort"
              className="h-8 w-28 sm:w-auto rounded-md border border-gardens-bdr bg-gardens-surf2 px-2 text-[13px] text-gardens-tx">
              <option value="stone">Stone not ordered, oldest</option>
              <option value="oldest">Oldest first</option>
              <option value="newest">Newest first</option>
              <option value="value">Highest value</option>
            </select>
          </label>
          <label className="shrink-0 flex items-center gap-1 text-[12px] text-gardens-txs whitespace-nowrap cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-3.5 w-3.5" />
            Show archived
          </label>
          <Button size="sm" className="h-8 shrink-0 bg-gardens-acc hover:bg-gardens-acc-dk text-white" onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="h-4 w-4 sm:mr-1" /><span className="sr-only sm:not-sr-only">New order</span>
          </Button>
        </div>
      </div>

      {kpi && (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gardens-acc-lt text-gardens-acc-dk border border-gardens-acc font-medium">
            {ORDER_KPI_LABEL[kpi]} · {filteredOrders.length} active orders
          </span>
          <button type="button" onClick={() => setKpi(null)} className="text-gardens-txs hover:text-gardens-tx underline">Clear</button>
        </div>
      )}

      {/* Active cemetery filter chip */}
      {searchParams.get('cemetery') && (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gardens-acc-lt text-gardens-acc-dk border border-gardens-acc font-medium">
            Cemetery filter active
          </span>
          <button
            type="button"
            onClick={() => setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('cemetery');
              return next;
            })}
            className="text-gardens-txs hover:text-gardens-tx underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Active column-filter chips */}
      {activeFilterColumns.length > 0 && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {activeFilterColumns.map((id) => {
            const values = columnFilters[id] ?? [];
            const firstLabel =
              (filterOptions[id].find((o) => o.value === values[0])?.label ?? values[0]) || '(blank)';
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gardens-acc-lt text-gardens-acc-dk border border-gardens-acc font-medium"
              >
                {FILTER_COLUMN_LABELS[id]}: {firstLabel}
                {values.length > 1 ? ` +${values.length - 1}` : ''}
                <button
                  type="button"
                  aria-label={`Clear ${FILTER_COLUMN_LABELS[id]} filter`}
                  onClick={() => handleColumnFilterChange(id, [])}
                  className="hover:text-gardens-tx"
                >
                  ×
                </button>
              </span>
            );
          })}
          {activeFilterColumns.length >= 2 && (
            <button
              type="button"
              onClick={() => setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                for (const id of FILTERABLE_COLUMN_IDS) next.delete(filterParamName(id));
                return next;
              })}
              className="text-gardens-txs hover:text-gardens-tx underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Orders table (no card wrapper) */}
      {isLoading ? (
        <div className="text-center py-8 text-gardens-txs">Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        // Mirrors the pipeline StageBoard empty state; tabs stay visible with (0) counts.
        <div className="text-center py-4 space-y-0.5">
          <p className="text-sm font-medium text-gardens-tx">
            {activeTab === 'all'
              ? 'No orders'
              : `No orders in ${activeTab === 'unassigned' ? 'Unassigned' : formatStageLabel(activeTab)}`}
          </p>
          <p className="text-xs text-gardens-txs">
            Nothing matches the current tab, search, and filters.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto min-w-0">
          <SortableOrdersTable
            orders={filteredOrders}
            onViewOrder={(order) => {
              const dbOrder = ordersData?.find((o) => o.id === order.id);
              if (dbOrder) setSelectedOrder(dbOrder);
            }}
            onEditOrder={handleEditOrder}
            onDeleteOrder={handleDeleteOrder}
            groupByNextAction
            defaultSort={sortMode}
            columnState={columnState}
            onColumnStateChange={setColumnState}
            columnFilters={columnFilters}
            onColumnFilterChange={handleColumnFilterChange}
            filterOptions={filterOptions}
          />
        </div>
      )}

      {/* Backdrop: close sidebar when clicking outside */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-40 bg-black/10"
          onClick={() => setSelectedOrder(null)}
          aria-hidden
        />
      )}

      {/* Order Details Sidebar */}
      <OrderDetailsSidebar 
        order={selectedOrder} 
        onClose={() => {
          setSelectedOrder(null);
          setSearchParams((prev) => {
            if (!prev.get('order')) return prev;
            const next = new URLSearchParams(prev);
            next.delete('order');
            return next;
          });
        }}
        onOrderUpdate={handleOrderUpdate}
        onSelectOrder={(id) => {
          const match = ordersData?.find((o) => o.id === id);
          if (match) setSelectedOrder(match);
        }}
        onNewOrder={(personId) => {
          setNewOrderPersonId(personId);
          setCreateDrawerOpen(true);
        }}
      />

      {/* Create Order Drawer */}
      <CreateOrderDrawer
        open={createDrawerOpen}
        onOpenChange={(open) => {
          setCreateDrawerOpen(open);
          if (!open) setNewOrderPersonId(null);
        }}
        initialPersonId={newOrderPersonId}
      />

      {/* Edit Order Drawer */}
      {orderToEdit && (
        <EditOrderDrawer
          open={editDrawerOpen}
          onOpenChange={(open) => {
            setEditDrawerOpen(open);
            if (!open) setOrderToEdit(null);
          }}
          order={orderToEdit}
        />
      )}

      {/* Delete Order Dialog */}
      {orderToDelete && (
        <DeleteOrderDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setOrderToDelete(null);
          }}
          order={orderToDelete}
        />
      )}

      {/* Columns Dialog */}
      <ColumnsDialog
        module="orders"
        open={columnsDialogOpen}
        onOpenChange={setColumnsDialogOpen}
        columnState={columnState}
        onColumnStateChange={setColumnState}
        availableColumns={getColumnDefinitions('orders')}
      />
    </div>
  );
};

export default OrdersPage;

