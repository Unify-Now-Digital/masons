import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Search, Plus, Filter, Calendar, MapPin, Clock, AlertTriangle, Settings, Columns } from 'lucide-react';
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

  const filteredOrders = useMemo(() => {
    if (!uiOrders) return [];
    return uiOrders.filter(order => {
      const matchesTab = activeTab === "all" || 
                        (activeTab === "overdue" && order.dueDate && getDaysUntilDue(order.dueDate) < 0) ||
                        (activeTab === "pending" && (order.permitStatus === "pending" || order.permitStatus === "form_sent" || order.proofStatus === "Not_Received")) ||
                        order.stoneStatus === activeTab || order.permitStatus === activeTab || order.proofStatus === activeTab;
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
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Order Management</h1>
          <p className="text-sm text-slate-600 mt-1">
            Track and manage all memorial orders
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setColumnsDialogOpen(true)}>
            <Columns className="h-4 w-4 mr-2" />
            Columns
          </Button>
          <Button variant="outline" onClick={() => setViewMode(viewMode === "table" ? "kanban" : "table")}>
            <Settings className="h-4 w-4 mr-2" />
            {viewMode === "table" ? "Kanban View" : "Table View"}
          </Button>
          <Button onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-sm text-slate-600">Active Orders</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <p className="text-sm text-slate-600">Pending Approval</p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                <p className="text-sm text-slate-600">Overdue</p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.readyForInstall}</div>
                <p className="text-sm text-slate-600">Ready for Install</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Orders</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Orders</CardTitle>
                <div className="flex gap-2 text-sm text-slate-600">
                  <span>Drag columns to reorder • Click headers to sort</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-slate-600">Loading orders...</div>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

