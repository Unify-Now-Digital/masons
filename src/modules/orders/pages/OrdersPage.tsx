import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { Search, Plus, Columns } from 'lucide-react';
import { SortableOrdersTable } from "../components/SortableOrdersTable";
import { OrderDetailsSidebar } from "../components/OrderDetailsSidebar";
import { CreateOrderDrawer } from "../components/CreateOrderDrawer";
import { EditOrderDrawer } from "../components/EditOrderDrawer";
import { DeleteOrderDialog } from "../components/DeleteOrderDialog";
import { useOrdersList } from "@/modules/orders/hooks/useOrders";
import { transformOrdersForUI, type UIOrder } from "../utils/orderTransform";
import type { Order } from "../types/orders.types";
import { ColumnsDialog } from '@/shared/tableViewPresets/components/ColumnsDialog';
import { usePresetsByModule } from '@/shared/tableViewPresets/hooks/useTableViewPresets';
import { applyPresetToState, getDefaultState, extractStateToConfig } from '@/shared/tableViewPresets/utils/columnState';
import { getColumnDefinitions } from '@/shared/tableViewPresets/config/defaultColumns';
import type { ColumnState } from '@/shared/tableViewPresets/types/tableViewPresets.types';

export const OrdersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [columnState, setColumnState] = useState<ColumnState>(() => getDefaultState('orders'));
  const columnStateInitializedRef = useRef(false);
  const loadedFromStorageRef = useRef(false);

  const { data: ordersData, isLoading, error } = useOrdersList();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: presets } = usePresetsByModule('orders');

  const STORAGE_KEY = 'orders.columns.v1';

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
  const uiOrders = useMemo(() => {
    if (!ordersData) return [];
    return transformOrdersForUI(ordersData);
  }, [ordersData]);

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
    o.stoneStatus === "In Stock" && o.permitStatus === "approved" && o.proofStatus === "Lettered";

  const isCompleted = (o: UIOrder) =>
    o.installationDate ? new Date(o.installationDate) < new Date() : false;

  const isInProgress = (o: UIOrder) =>
    !isReadyForInstall(o) && !isCompleted(o);

  const filteredOrders = useMemo(() => {
    if (!uiOrders) return [];
    return uiOrders.filter(order => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "in_progress" && isInProgress(order)) ||
        (activeTab === "ready_to_install" && isReadyForInstall(order)) ||
        (activeTab === "completed" && isCompleted(order));
      const matchesSearch = searchQuery === "" ||
                           order.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (order.deceasedName && order.deceasedName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                           order.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [uiOrders, activeTab, searchQuery]);

  const stats = useMemo(() => {
    if (!uiOrders) {
      return { total: 0, pending: 0, overdue: 0, readyForInstall: 0 };
    }
    return {
      total: uiOrders.length,
      pending: uiOrders.filter(o => o.permitStatus === "pending" || o.permitStatus === "form_sent" || o.proofStatus === "Not_Received").length,
      overdue: uiOrders.filter(o => o.dueDate && getDaysUntilDue(o.dueDate) < 0).length,
      readyForInstall: uiOrders.filter(o => o.stoneStatus === "In Stock" && o.permitStatus === "approved" && o.proofStatus === "Lettered").length
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
        <div className="text-red-600">
          Error loading orders: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="font-head text-xl sm:text-2xl font-semibold text-gardens-tx tracking-tight">Orders</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-sm text-gardens-txs">{stats.total} orders</span>
            {stats.pending > 0 && (
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border bg-gardens-amb-lt text-gardens-amb-dk border-[#F0C8A0]">
                {stats.pending} Pending
              </span>
            )}
            {stats.overdue > 0 && (
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border bg-gardens-red-lt text-gardens-red-dk border-[#F5C0C0]">
                {stats.overdue} Overdue
              </span>
            )}
            {stats.readyForInstall > 0 && (
              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border bg-gardens-grn-lt text-gardens-grn-dk border-[#B8D8C0]">
                {stats.readyForInstall} Ready
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setColumnsDialogOpen(true)}>
            <Columns className="h-4 w-4 mr-1.5" />
            Columns
          </Button>
          <Button size="sm" className="bg-gardens-acc hover:bg-gardens-acc-dk text-white" onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New order
          </Button>
        </div>
      </div>

      {/* Filter bar: tabs + search */}
      <div className="flex items-center gap-3 border-b border-gardens-bdr pb-3 flex-wrap">
        <div className="flex gap-0.5 overflow-x-auto scrollbar-hide">
          {[
            { value: 'all', label: 'All orders' },
            { value: 'in_progress', label: 'In progress' },
            { value: 'ready_to_install', label: 'Ready to install' },
            { value: 'completed', label: 'Completed' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'text-[11px] font-semibold px-3 py-1.5 rounded-md whitespace-nowrap border transition-colors',
                activeTab === tab.value
                  ? 'bg-gardens-surf2 text-gardens-tx border-gardens-bdr'
                  : 'text-gardens-txs border-transparent hover:bg-gardens-page'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[140px] max-w-xs ml-auto">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gardens-txm pointer-events-none" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm border-gardens-bdr bg-gardens-surf2 placeholder:text-gardens-txm"
          />
        </div>
      </div>

      {/* Orders table (no card wrapper) */}
      {isLoading ? (
        <div className="text-center py-8 text-gardens-txs">Loading orders...</div>
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
            columnState={columnState}
            onColumnStateChange={setColumnState}
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
      />

      {/* Create Order Drawer */}
      <CreateOrderDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
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

