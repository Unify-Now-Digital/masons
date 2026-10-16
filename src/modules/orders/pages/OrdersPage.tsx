import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from "@/shared/lib/utils";
import { ORDER_KPI_LABEL, kpiSummary, matchesKpi, type OrderKpi } from '../utils/orderKpis';
import type { DefaultSortMode } from '../utils/orderDefaultSort';
import { readOrdersView, writeOrdersView, type OrdersViewState } from '../utils/orderGroups';
import { OrdersToolbar } from '../components/OrdersToolbar';
import { useSupplierLinkDecision } from '@/modules/supplier/hooks/useSupplierBoard';
import { getOrderDisplayId } from '../utils/orderDisplayId';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { useOrganization } from '@/shared/context/OrganizationContext';
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
  orderTabCounts, splitOrderTabs,
  type OrdersTab,
} from "../utils/orderGrouping";
import { transformOrdersForUI, type UIOrder } from "../utils/orderTransform";
import { supplierRollupFor, useSupplierBoard } from "@/modules/supplier/hooks/useSupplierBoard";
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

const PINNED_TABS: OrdersTab[] = ['confirmed', 'invoiced', 'all'];
const STAGE_TABS: OrdersTab[] = ['enquired', 'quoted', ...ORDERS_AFTER_PAYMENT_TABS.filter((stage) => stage !== 'confirmed')];
const ATTENTION: OrderKpi[] = ['permit', 'stone', 'proof', 'balance'];

function tabLabel(tab: OrdersTab): string {
  return tab === 'all' ? 'All' : formatStageLabel(tab);
}

export const OrdersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<OrdersTab>('confirmed');
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<DefaultSortMode>('priority');
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
  const [columnState, setColumnState] = useState<ColumnState>(() => getDefaultState('orders'));
  const columnStateInitializedRef = useRef(false);
  const loadedFromStorageRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const columnFilters = useMemo(() => parseColumnFilters(searchParams), [searchParams]);
  const { organizationId } = useOrganization();
  const { data: presets } = usePresetsByModule('orders', organizationId);
  const canSeeMoney = useCanSeeMoney();
  const [view, setView] = useState<OrdersViewState>(() => readOrdersView(organizationId));
  useEffect(() => {
    setView(readOrdersView(organizationId));
  }, [organizationId]);
  const updateView = useCallback((patch: Partial<OrdersViewState>) => {
    setView((prev) => {
      const next = { ...prev, ...patch };
      if (organizationId) writeOrdersView(organizationId, next);
      return next;
    });
  }, [organizationId]);
  const { data: ordersData, isLoading, error } = useOrdersList({ includeArchived: view.includeArchived });
  const supplierDecision = useSupplierLinkDecision();

  // v2 (2026-10-14): secondary columns hidden by default; v1 saved 'all visible'.
  const STORAGE_KEY = 'orders.columns.v4'; // v4: IA-10 board columns (next step, product, permit, proof)

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
  const supplierBoard = useSupplierBoard(organizationId);
  const uiOrders = useMemo(() => {
    if (!ordersData) return [];
    return transformOrdersForUI(ordersData, canSeeMoney).map((o) => ({
      ...o,
      ...(paidMap ? { amountPaid: paidMap[o.id] ?? 0 } : {}),
      supplier: supplierRollupFor(supplierBoard, o.id),
      supplierLoaded: supplierBoard.loaded,
    }));
  }, [ordersData, paidMap, supplierBoard, canSeeMoney]);

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

  const handleOrderUpdate = (_orderId: string, _updates: Partial<Order>) => {
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
      const q = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === "" ||
                           order.customer.toLowerCase().includes(q) ||
                           (order.deceasedName && order.deceasedName.toLowerCase().includes(q)) ||
                           order.id.toLowerCase().includes(q) ||
                           getOrderDisplayId(order).toLowerCase().includes(q);
      const matchesCemetery = !allowedByCemetery || allowedByCemetery.has(order.id);
      return matchesSearch && matchesCemetery && matchesColumnFilters(order, columnFilters);
    });
  }, [uiOrders, ordersData, searchQuery, searchParams, columnFilters]);

  const unassignedCount = useMemo(
    () => scopedOrders.filter((order) => order.group === 'unassigned').length,
    [scopedOrders],
  );
  const listedOrders = useMemo(
    () => (view.unassignedOnly ? scopedOrders.filter((order) => order.group === 'unassigned') : scopedOrders),
    [scopedOrders, view.unassignedOnly],
  );

  // Unknown stages count as Unassigned so the tabs always sum to All.
  const tabCounts = useMemo(() => orderTabCounts(listedOrders), [listedOrders]);

  const filteredOrders = useMemo(
    () => (kpi ? listedOrders.filter((o) => matchesKpi(o, kpi))
      : activeTab === 'all' ? listedOrders : listedOrders.filter((o) => o.group === activeTab)),
    [listedOrders, activeTab, kpi]
  );

  const kpis = useMemo(() => kpiSummary(listedOrders), [listedOrders]);
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
    } else if (!view.includeArchived) {
      // Deep links (e.g. map "View Order") can point at an archived order: load archived rows and retry.
      updateView({ includeArchived: true });
    }
  }, [searchParams, selectedOrder, ordersData, view.includeArchived, updateView]);

  if (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong while loading orders.';
    return (
      <div className="flex flex-col gap-3">
        <h1 className="sr-only">Orders</h1>
        <div role="alert" className="rounded-lg border border-gardens-sem-red/40 bg-gardens-sem-red-lt px-4 py-3">
          <p className="m-0 text-[14px] font-semibold text-gardens-sem-red">Couldn&apos;t load orders</p>
          <p className="m-0 mt-1 text-[13px] text-gardens-tx">{message}</p>
        </div>
      </div>
    );
  }

  const tabSplit = splitOrderTabs(activeTab, PINNED_TABS, [...STAGE_TABS, 'unassigned']);
  const visibleTabs = tabSplit.visible.map((value) => ({
    value,
    label: tabLabel(value),
    count: tabCounts[value],
  }));
  const moreTabs = tabSplit.more.map((value) => ({
    value,
    label: tabLabel(value),
    count: tabCounts[value],
  }));
  const attention = ATTENTION.filter((key) => kpis[key].count > 0).map((key) => ({
    key,
    label: ORDER_KPI_LABEL[key],
    count: kpis[key].count,
    overdue: kpis[key].overdue > 0,
    pressed: kpi === key,
  }));
  const filterExtras = (searchParams.get('cemetery') || activeFilterColumns.length > 0) ? (
    <>
      {searchParams.get('cemetery') && (
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-gardens-acc bg-gardens-acc-lt px-2 text-xs font-medium text-gardens-acc-dk">
          Cemetery filter active
          <button
            type="button"
            onClick={() => setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('cemetery');
              return next;
            })}
            className="underline"
          >
            Clear
          </button>
        </span>
      )}
      {(columnFilters.supplier ?? []).length > 0 && (
        <span data-testid="supplier-filter-chip" className="inline-flex h-7 items-center gap-1.5 rounded-full border border-gardens-acc bg-gardens-acc-lt px-2 text-xs font-medium text-gardens-acc-dk">
          Supplier: {(columnFilters.supplier ?? []).join(', ')}
          <button type="button" onClick={() => handleColumnFilterChange('supplier', [])}>Clear all</button>
        </span>
      )}
      {activeFilterColumns.filter((id) => id !== 'supplier').map((id) => {
        const values = columnFilters[id] ?? [];
        const firstLabel = (filterOptions[id].find((option) => option.value === values[0])?.label ?? values[0]) || '(blank)';
        return (
          <span key={id} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-gardens-acc bg-gardens-acc-lt px-2 text-xs font-medium text-gardens-acc-dk">
            {FILTER_COLUMN_LABELS[id]}: {firstLabel}{values.length > 1 ? ` +${values.length - 1}` : ''}
            <button type="button" aria-label={`Clear ${FILTER_COLUMN_LABELS[id]} filter`} onClick={() => handleColumnFilterChange(id, [])}>×</button>
          </span>
        );
      })}
    </>
  ) : null;

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3.5 overflow-x-clip">
      <h1 className="sr-only">Orders</h1>
      <OrdersToolbar
        tabs={visibleTabs}
        moreTabs={moreTabs}
        activeTab={activeTab}
        kpiActive={kpi != null}
        onTab={(tab) => { setKpi(null); setActiveTab(tab); }}
        search={searchQuery}
        onSearch={setSearchQuery}
        groupBy={view.group}
        onGroup={(group) => updateView({ group })}
        sortMode={sortMode}
        onSort={setSortMode}
        unassignedOnly={view.unassignedOnly}
        unassignedCount={unassignedCount}
        onUnassigned={(unassignedOnly) => updateView({ unassignedOnly })}
        includeArchived={view.includeArchived}
        onArchived={(includeArchived) => updateView({ includeArchived })}
        onColumns={() => setColumnsDialogOpen(true)}
        onNewOrder={() => setCreateDrawerOpen(true)}
        attention={attention}
        onAttention={(key) => {
          const on = kpi === key;
          setKpi(on ? null : key);
          if (!on) setActiveTab('all');
        }}
        supplierFilters={filterOptions.supplier.map((option) => ({
          value: option.value,
          count: option.count ?? 0,
          on: (columnFilters.supplier ?? []).includes(option.value),
        }))}
        onSupplierFilter={(value) => {
          const current = columnFilters.supplier ?? [];
          const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
          handleColumnFilterChange('supplier', next);
        }}
        onClearSupplierFilters={() => handleColumnFilterChange('supplier', [])}
        filtersOn={activeFilterColumns.length > 0 || !!searchParams.get('cemetery') || kpi != null}
        onClearFilters={() => {
          setKpi(null);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('cemetery');
            for (const id of FILTERABLE_COLUMN_IDS) next.delete(filterParamName(id));
            return next;
          });
        }}
        extras={filterExtras}
      />

      <div className={cn('min-w-0', selectedOrder && 'lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-stretch')}>
      <div className="min-w-0">
      {isLoading ? (
        <div className="text-center py-8 text-gardens-txs">Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gardens-bdr bg-gardens-surf px-4 py-8 text-center">
          <p className="m-0 text-[15px] font-semibold text-gardens-tx">
            {searchQuery || activeFilterColumns.length > 0 || searchParams.get('cemetery') || kpi
              ? 'No orders match'
              : activeTab === 'all'
                ? 'No orders yet'
                : `Nothing in ${activeTab === 'unassigned' ? 'Unassigned' : formatStageLabel(activeTab)}`}
          </p>
          <p className="m-0 mt-1 text-[13px] text-gardens-txs">
            {searchQuery || activeFilterColumns.length > 0 || searchParams.get('cemetery') || kpi
              ? 'Try another name, or clear the search and filters.'
              : 'New memorials will appear here once an order is created.'}
          </p>
        </div>
      ) : (
        <div className="min-w-0">
          <SortableOrdersTable
            orders={filteredOrders}
            onViewOrder={(order) => {
              const dbOrder = ordersData?.find((o) => o.id === order.id);
              if (dbOrder) setSelectedOrder(dbOrder);
            }}
            onEditOrder={handleEditOrder}
            onDeleteOrder={handleDeleteOrder}
            groupBy={view.group}
            defaultSort={sortMode}
            onConfirmMatch={(linkId) => supplierDecision.mutate({ linkId, decision: 'confirmed' })}
            onRejectMatch={(linkId) => supplierDecision.mutate({ linkId, decision: 'rejected' })}
            matchPending={supplierDecision.isPending}
            columnState={columnState}
            onColumnStateChange={setColumnState}
            columnFilters={columnFilters}
            onColumnFilterChange={handleColumnFilterChange}
            filterOptions={filterOptions}
          />
        </div>
      )}
      </div>

      {selectedOrder && (
        <OrderDetailsSidebar
        layout="inline"
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
      )}
      </div>

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
        availableColumns={getColumnDefinitions('orders').filter((column) => column.id !== 'supplier')}
      />
    </div>
  );
};

export default OrdersPage;

