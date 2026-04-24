import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Search, Plus, Download, Eye, AlertCircle, DollarSign, TrendingUp, Edit, Trash2, ChevronRight, ChevronDown, Columns } from 'lucide-react';
import { useInvoicesList, invoicesKeys } from '../hooks/useInvoices';
import { transformInvoicesForUI, type UIInvoice } from '../utils/invoiceTransform';
import { CreateInvoiceDrawer } from '../components/CreateInvoiceDrawer';
import { EditInvoiceDrawer } from '../components/EditInvoiceDrawer';
import { DeleteInvoiceDialog } from '../components/DeleteInvoiceDialog';
import { ReviseInvoiceModal } from '../components/ReviseInvoiceModal';
import { InvoiceDetailSidebar } from '../components/InvoiceDetailSidebar';
import { ExpandedInvoiceOrders } from '../components/ExpandedInvoiceOrders';
import { CustomerDetailsPopover } from '@/shared/components/customer/CustomerDetailsPopover';
import type { Invoice } from '../types/invoicing.types';
import type { CreateStripeInvoiceResponse } from '../api/stripe.api';
import { ColumnsDialog } from '@/shared/tableViewPresets/components/ColumnsDialog';
import { usePresetsByModule } from '@/shared/tableViewPresets/hooks/useTableViewPresets';
import { applyPresetToState, getDefaultState, extractStateToConfig } from '@/shared/tableViewPresets/utils/columnState';
import { getColumnDefinitions } from '@/shared/tableViewPresets/config/defaultColumns';
import type { ColumnState } from '@/shared/tableViewPresets/types/tableViewPresets.types';
import { invoiceColumnDefinitions } from '../components/invoiceColumnDefinitions';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchInvoice } from '../api/invoicing.api';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { useIsMobile } from '@/shared/hooks/use-mobile';

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export const InvoicingPage: React.FC = () => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [reviseModalOpen, setReviseModalOpen] = useState(false);
  const [invoiceToRevise, setInvoiceToRevise] = useState<Invoice | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [columnState, setColumnState] = useState<ColumnState>(() => getDefaultState('invoices'));
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const resizeRef = useRef<HTMLDivElement>(null);
  const columnStateInitializedRef = useRef(false);
  const [focusCollectPayment, setFocusCollectPayment] = useState(false);

  const handleStripeInvoiceCreatedFromTable = useCallback(
    (invoiceId: string, data: CreateStripeInvoiceResponse) => {
      setSelectedInvoice((prev) =>
        prev?.id === invoiceId
          ? {
              ...prev,
              stripe_invoice_id: data.stripe_invoice_id,
              hosted_invoice_url: data.hosted_invoice_url ?? prev.hosted_invoice_url,
              stripe_invoice_status: (data.stripe_invoice_status ?? prev.stripe_invoice_status) ?? null,
              amount_paid: data.amount_paid ?? prev.amount_paid,
              amount_remaining: data.amount_remaining ?? prev.amount_remaining,
            }
          : prev
      );
    },
    []
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { organizationId } = useOrganization();
  const { data: invoicesData, isLoading, error } = useInvoicesList();
  const { data: presets } = usePresetsByModule('invoices');

  // Post-payment redirect: ?stripe=success&invoice_id=... → invalidate, open sidebar, toast
  useEffect(() => {
    const stripe = searchParams.get('stripe');
    const invoiceId = searchParams.get('invoice_id');
    if (stripe !== 'success' || !invoiceId) return;

    (async () => {
      await queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      if (organizationId) {
        await queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(invoiceId, organizationId) });
      }
      try {
        if (organizationId) {
          const inv = await fetchInvoice(invoiceId, organizationId);
          setSelectedInvoice(inv);
          toast({
            title: 'Payment successful',
            description: 'The invoice has been marked as paid.',
          });
        }
      } catch {
        toast({
          variant: 'destructive',
          title: 'Payment recorded',
          description: 'Could not load invoice details. The list will refresh.',
        });
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('stripe');
        next.delete('invoice_id');
        next.delete('session_id');
        return next;
      });
    })();
  }, [searchParams, queryClient, setSearchParams, toast, organizationId]);

  // Partial-payment redirect: ?pay=success&invoice=... → invalidate invoice + payments, open sidebar
  useEffect(() => {
    const pay = searchParams.get('pay');
    const invoiceId = searchParams.get('invoice');
    if (pay !== 'success' || !invoiceId) return;

    (async () => {
      await queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      if (organizationId) {
        await queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(invoiceId, organizationId) });
        await queryClient.invalidateQueries({ queryKey: invoicesKeys.payments(invoiceId, organizationId) });
      }
      try {
        if (organizationId) {
          const inv = await fetchInvoice(invoiceId, organizationId);
          setSelectedInvoice(inv);
        }
      } catch {
        // Best-effort; list will still refresh
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('pay');
        next.delete('invoice');
        return next;
      });
    })();
  }, [searchParams, queryClient, setSearchParams, organizationId]);

  // Deep-link/open invoice sidebar: ?invoice=<id> → open sidebar (used by Inbox "Open invoice")
  useEffect(() => {
    const invoiceId = searchParams.get('invoice');
    const focus = searchParams.get('focus');
    const pay = searchParams.get('pay');
    const stripe = searchParams.get('stripe');

    // Avoid clashing with other redirect flows handled elsewhere.
    if (!invoiceId || !organizationId) return;
    if (pay === 'success') return;
    if (stripe === 'success') return;
    if (focus === 'collect') return;
    if (selectedInvoice?.id === invoiceId) return;

    fetchInvoice(invoiceId, organizationId)
      .then((inv) => setSelectedInvoice(inv))
      .catch(() => {});
  }, [searchParams, selectedInvoice?.id, organizationId]);

  // Load column state on mount: prefer localStorage (user's last session), else default preset
  useEffect(() => {
    const storageKey = 'invoices_column_state';
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const config = JSON.parse(saved) as { version?: number; columns?: { visibility?: Record<string, boolean>; order?: string[]; widths?: Record<string, number> } };
        if (config?.columns) {
          const fullConfig = { version: config.version ?? 1, columns: config.columns };
          const newState = applyPresetToState(fullConfig, 'invoices');
          setColumnState(newState);
          columnStateInitializedRef.current = true;
          return;
        }
      }
    } catch {
      // Ignore parse errors
    }
    if (presets) {
      const defaultPreset = presets.find(p => p.is_default);
      if (defaultPreset) {
        const newState = applyPresetToState(defaultPreset.config, 'invoices');
        setColumnState(newState);
      }
    }
    columnStateInitializedRef.current = true;
  }, [presets]);

  const handleColumnStateChange = useCallback((newState: ColumnState) => {
    setColumnState(newState);
  }, []);

  // Persist column state to localStorage when it changes (after initial load)
  useEffect(() => {
    if (!columnStateInitializedRef.current) return;
    try {
      const config = extractStateToConfig(columnState);
      localStorage.setItem('invoices_column_state', JSON.stringify(config));
    } catch {
      // Ignore persistence errors
    }
  }, [columnState]);

  // Transform invoices from DB format to UI format
  const uiInvoices = useMemo(() => {
    if (!invoicesData) return [];
    return transformInvoicesForUI(invoicesData);
  }, [invoicesData]);

  const toggleInvoiceExpansion = (invoiceId: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-gardens-grn-lt text-gardens-grn-dk";
      case "pending": return "bg-gardens-amb-lt text-gardens-amb-dk";
      case "overdue": return "bg-gardens-red-lt text-gardens-red-dk";
      case "draft": return "bg-gardens-page text-gardens-tx";
      case "cancelled": return "bg-gardens-page text-gardens-tx";
      default: return "bg-gardens-page text-gardens-tx";
    }
  };

  // Get visible columns in order
  const visibleColumns = useMemo(() => {
    return invoiceColumnDefinitions
      .filter(col => columnState.visibility[col.id] !== false)
      .sort((a, b) => {
        const aIndex = columnState.order.indexOf(a.id);
        const bIndex = columnState.order.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
  }, [columnState]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const computeNextOrderPreservingHidden = useCallback(
    (fullOrder: string[], visibleIds: string[], activeId: string, overId: string) => {
      if (activeId === overId) return fullOrder;

      const visibleSet = new Set(visibleIds);
      const visibleInFullOrder = fullOrder.filter((id) => visibleSet.has(id));
      if (visibleInFullOrder.length !== visibleIds.length) return fullOrder;

      const oldIndex = visibleInFullOrder.indexOf(activeId);
      const newIndex = visibleInFullOrder.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return fullOrder;

      const movedVisibleIds = arrayMove(visibleInFullOrder, oldIndex, newIndex);

      let movedIndex = 0;
      return fullOrder.map((id) => {
        if (!visibleSet.has(id)) return id;
        const nextId = movedVisibleIds[movedIndex];
        movedIndex += 1;
        return nextId ?? id;
      });
    },
    []
  );

  const handleHeaderDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (isMobile) return;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      const fullOrder = columnState.order;
      const visibleIds = visibleColumns.map((c) => c.id);
      const nextOrder = computeNextOrderPreservingHidden(
        fullOrder,
        visibleIds,
        activeId,
        overId
      );

      const changed =
        nextOrder.length !== fullOrder.length ||
        nextOrder.some((id, i) => id !== fullOrder[i]);
      if (!changed) return;

      setColumnState((prev) => ({
        ...prev,
        order: nextOrder,
      }));
    },
    [isMobile, columnState.order, visibleColumns, computeNextOrderPreservingHidden]
  );

  const SortableInvoiceHeaderCell: React.FC<{
    column: (typeof visibleColumns)[number];
    width: number;
  }> = ({ column, width }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: column.id });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.85 : 1,
    };

    return (
      <TableHead
        className="relative"
        style={{ width: `${width}px`, minWidth: `${width}px` }}
      >
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          className="h-full pr-3 flex items-center"
        >
          {column.renderHeader()}
        </div>
        <div
          ref={resizeRef}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-gardens-blu bg-transparent"
          onMouseDown={(e) => handleResizeStart(column.id, e)}
          style={{ zIndex: 10 }}
        />
      </TableHead>
    );
  };

  // Column resizing handlers
  const handleResizeStart = useCallback((columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnId);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnState.widths[columnId] || invoiceColumnDefinitions.find(col => col.id === columnId)?.defaultWidth || 100);
  }, [columnState.widths]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn) return;

    const diff = e.clientX - resizeStartX;
    const newWidth = Math.max(50, resizeStartWidth + diff);

    setColumnState(prev => ({
      ...prev,
      widths: {
        ...prev.widths,
        [resizingColumn]: newWidth,
      },
    }));
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
  }, []);

  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);

  const filteredInvoices = useMemo(() => {
    if (!uiInvoices) return [];
    return uiInvoices.filter(invoice => {
      const matchesTab = activeTab === "all" || invoice.status === activeTab;
      const matchesSearch = searchQuery === "" || 
                           invoice.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [uiInvoices, activeTab, searchQuery]);

  const handleFocusCollectPayment = useCallback(
    (invoiceId: string) => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('invoice', invoiceId);
        next.set('focus', 'collect');
        return next;
      });
    },
    [setSearchParams],
  );

  const stats = useMemo(() => {
    if (!uiInvoices) {
      return { totalOutstanding: 0, totalPaid: 0, overdueCount: 0, collectionRate: 0 };
    }
    
    const totalOutstanding = uiInvoices
      .filter(inv => inv.status !== "paid" && inv.status !== "cancelled")
      .reduce((sum, inv) => {
        const amount = parseFloat(inv.amount.replace(/[^0-9.]/g, '').replace(/,/g, ''));
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    const totalPaid = uiInvoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => {
        const amount = parseFloat(inv.amount.replace(/[^0-9.]/g, '').replace(/,/g, ''));
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    const overdueCount = uiInvoices.filter(inv => inv.status === "overdue").length;
    
    const totalAmount = uiInvoices.reduce((sum, inv) => {
      const amount = parseFloat(inv.amount.replace(/[^0-9.]/g, '').replace(/,/g, ''));
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const collectionRate = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

    return { totalOutstanding, totalPaid, overdueCount, collectionRate };
  }, [uiInvoices]);

  // Focus collect payment section when coming from table "Partial" action
  useEffect(() => {
    const focus = searchParams.get('focus');
    const invoiceId = searchParams.get('invoice');
    if (focus !== 'collect' || !invoiceId) return;

    (async () => {
      try {
        if (organizationId) {
          const inv = await fetchInvoice(invoiceId, organizationId);
          setSelectedInvoice(inv);
          setFocusCollectPayment(true);
        }
      } catch {
        // best-effort; sidebar may already have enough data
      }
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('focus');
        return next;
      });
    })();
  }, [searchParams, setSearchParams, organizationId]);

  const handleEditInvoice = (invoice: UIInvoice) => {
    // Find the original DB invoice by ID
    const dbInvoice = invoicesData?.find((inv) => inv.id === invoice.id);
    if (dbInvoice) {
      setInvoiceToEdit(dbInvoice);
      setEditDrawerOpen(true);
    }
  };

  const handleDeleteInvoice = (invoice: UIInvoice) => {
    // Find the original DB invoice by ID
    const dbInvoice = invoicesData?.find((inv) => inv.id === invoice.id);
    if (dbInvoice) {
      setInvoiceToDelete(dbInvoice);
      setDeleteDialogOpen(true);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-gardens-red-dk">
          Error loading invoices: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Invoicing</h1>
          <p className="text-sm text-gardens-tx mt-1">
            Manage invoices and track payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{formatGbpDecimal(stats.totalOutstanding)}</div>
                <p className="text-sm text-gardens-tx">Outstanding</p>
              </div>
              <div className="h-8 w-8 bg-gardens-amb-lt rounded-full flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-gardens-amb-dk" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gardens-red-dk">{stats.overdueCount}</div>
                <p className="text-sm text-gardens-tx">Overdue Invoices</p>
              </div>
              <div className="h-8 w-8 bg-gardens-red-lt rounded-full flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-gardens-red-dk" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gardens-grn-dk">{formatGbpDecimal(stats.totalPaid)}</div>
                <p className="text-sm text-gardens-tx">Paid This Month</p>
              </div>
              <div className="h-8 w-8 bg-gardens-grn-lt rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-gardens-grn-dk" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.collectionRate}%</div>
                <p className="text-sm text-gardens-tx">Collection Rate</p>
              </div>
              <div className="h-8 w-8 bg-gardens-blu-lt rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-gardens-blu-dk" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-gardens-txs" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => setColumnsDialogOpen(true)}>
          <Columns className="h-4 w-4 mr-2" />
          Columns
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Invoices</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-gardens-tx">Loading invoices...</div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-8 text-gardens-tx">
                  {searchQuery ? 'No invoices match your search.' : 'No invoices found.'}
                </div>
              ) : (
                <div className="overflow-x-auto min-w-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isMobile ? (
                        visibleColumns.map((column) => {
                          const width = columnState.widths[column.id] || column.defaultWidth;
                          return (
                            <TableHead
                              key={column.id}
                              className="relative"
                              style={{ width: `${width}px`, minWidth: `${width}px` }}
                            >
                              {column.renderHeader()}
                              <div
                                ref={resizeRef}
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-gardens-blu bg-transparent"
                                onMouseDown={(e) => handleResizeStart(column.id, e)}
                                style={{ zIndex: 10 }}
                              />
                            </TableHead>
                          );
                        })
                      ) : (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleHeaderDragEnd}
                        >
                          <SortableContext
                            items={visibleColumns.map((c) => c.id)}
                            strategy={horizontalListSortingStrategy}
                          >
                            {visibleColumns.map((column) => {
                              const width = columnState.widths[column.id] || column.defaultWidth;
                              return (
                                <SortableInvoiceHeaderCell
                                  key={column.id}
                                  column={column}
                                  width={width}
                                />
                              );
                            })}
                          </SortableContext>
                        </DndContext>
                      )}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => [
                      <TableRow key={invoice.id} className="hover:bg-gardens-page">
                        {visibleColumns.map((column) => {
                          const width = columnState.widths[column.id] || column.defaultWidth;
                          const cell = column.renderCell(invoice, {
                            isExpanded: expandedInvoices.has(invoice.id),
                            onToggleExpand: () => toggleInvoiceExpansion(invoice.id),
                            onFocusCollectPayment: handleFocusCollectPayment,
                          });
                          
                          // Apply width to the cell
                          if (React.isValidElement(cell)) {
                            return React.cloneElement(cell, {
                              key: column.id,
                              style: { 
                                ...(cell.props.style || {}),
                                width: `${width}px`, 
                                minWidth: `${width}px`,
                                maxWidth: `${width}px`,
                              },
                            });
                          }
                          return cell;
                        })}
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={invoice.isLocked}
                              title={invoice.isLocked ? 'Invoice locked — payments started' : 'Edit invoice'}
                              onClick={() => handleEditInvoice(invoice)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteInvoice(invoice)}
                              className="text-gardens-red-dk hover:text-gardens-red-dk hover:bg-gardens-red-lt"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const dbInvoice = invoicesData?.find((inv) => inv.id === invoice.id);
                                if (dbInvoice) setSelectedInvoice(dbInvoice);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>,
                      expandedInvoices.has(invoice.id) && (
                        <ExpandedInvoiceOrders
                          key={`${invoice.id}-expanded`}
                          invoiceId={invoice.id}
                          onStripeInvoiceCreated={handleStripeInvoiceCreatedFromTable}
                        />
                      ),
                    ])}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Invoice Drawer */}
      <CreateInvoiceDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />

      {/* Edit Invoice Drawer */}
      {invoiceToEdit && (
        <EditInvoiceDrawer
          open={editDrawerOpen}
          onOpenChange={(open) => {
            setEditDrawerOpen(open);
            if (!open) setInvoiceToEdit(null);
          }}
          invoice={invoiceToEdit}
        />
      )}

      {/* Delete Invoice Dialog */}
      {invoiceToDelete && (
        <DeleteInvoiceDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setInvoiceToDelete(null);
          }}
          invoice={invoiceToDelete}
          onDeleted={(deletedId) => {
            if (selectedInvoice?.id === deletedId) {
              setSelectedInvoice(null);
            }
          }}
        />
      )}

      {/* Backdrop: close sidebar when clicking outside */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 z-40 bg-black/10"
          onClick={() => setSelectedInvoice(null)}
          aria-hidden
        />
      )}

      {/* Invoice Detail Sidebar */}
      <InvoiceDetailSidebar
        invoice={selectedInvoice}
        onClose={() => {
          setSelectedInvoice(null);
          // If the sidebar was opened via ?invoice=..., clear it so it doesn't immediately reopen.
          setSearchParams((prev) => {
            if (!prev.get('invoice')) return prev;
            const next = new URLSearchParams(prev);
            next.delete('invoice');
            next.delete('focus');
            return next;
          });
        }}
        onReviseInvoice={(inv) => {
          setInvoiceToRevise(inv);
          setReviseModalOpen(true);
        }}
        onSelectInvoice={(id) => {
          if (organizationId) {
            fetchInvoice(id, organizationId).then(setSelectedInvoice).catch(() => {});
          }
        }}
        onStripeInvoiceCreated={(data) => {
          setSelectedInvoice((prev) =>
            prev
              ? {
                  ...prev,
                  stripe_invoice_id: data.stripe_invoice_id,
                  hosted_invoice_url: data.hosted_invoice_url ?? prev.hosted_invoice_url,
                  stripe_invoice_status: (data.stripe_invoice_status ?? prev.stripe_invoice_status) ?? null,
                  amount_paid: data.amount_paid ?? prev.amount_paid,
                  amount_remaining: data.amount_remaining ?? prev.amount_remaining,
                }
              : null
          );
        }}
        focusCollectPayment={focusCollectPayment}
        onCollectFocused={() => setFocusCollectPayment(false)}
      />

      {/* Revise Invoice Modal */}
      <ReviseInvoiceModal
        open={reviseModalOpen}
        onOpenChange={(open) => {
          setReviseModalOpen(open);
          if (!open) setInvoiceToRevise(null);
        }}
        invoice={invoiceToRevise}
        onRevised={(newId) => {
          if (organizationId) {
            fetchInvoice(newId, organizationId).then(setSelectedInvoice).catch(() => {});
          }
        }}
      />

      {/* Columns Dialog */}
      <ColumnsDialog
        module="invoices"
        open={columnsDialogOpen}
        onOpenChange={setColumnsDialogOpen}
        columnState={columnState}
        onColumnStateChange={handleColumnStateChange}
        availableColumns={getColumnDefinitions('invoices')}
      />
    </div>
  );
};

export default InvoicingPage;
