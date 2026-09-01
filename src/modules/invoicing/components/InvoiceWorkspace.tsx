import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { Search, Plus, Download, Eye, Edit, Trash2, Columns } from 'lucide-react';
import { invoicesKeys } from '../hooks/useInvoices';
import { transformInvoicesForUI, type UIInvoice } from '../utils/invoiceTransform';
import {
  classifyRowForFilter,
  isReliableDueDate,
  type TileFilter,
} from '@/modules/finance/utils/invoiceRemaining';
import { CreateInvoiceDrawer } from './CreateInvoiceDrawer';
import { EditInvoiceDrawer } from './EditInvoiceDrawer';
import { DeleteInvoiceDialog } from './DeleteInvoiceDialog';
import { ReviseInvoiceModal } from './ReviseInvoiceModal';
import { InvoiceDetailSidebar } from './InvoiceDetailSidebar';
import { ExpandedInvoiceOrders } from './ExpandedInvoiceOrders';
import type { Invoice } from '../types/invoicing.types';
import { ColumnsDialog } from '@/shared/tableViewPresets/components/ColumnsDialog';
import { usePresetsByModule } from '@/shared/tableViewPresets/hooks/useTableViewPresets';
import { applyPresetToState, getDefaultState, extractStateToConfig } from '@/shared/tableViewPresets/utils/columnState';
import { getColumnDefinitions } from '@/shared/tableViewPresets/config/defaultColumns';
import type { ColumnState } from '@/shared/tableViewPresets/types/tableViewPresets.types';
import { invoiceColumnDefinitions } from './invoiceColumnDefinitions';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchInvoice } from '../api/invoicing.api';
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

interface InvoiceWorkspaceProps {
  /** Unified working set (post enquiry-hiding, FinancePage-owned), RAW DB rows. */
  invoices: Invoice[];
  /** The only list filter (FR-002); 'all' = no filter (paid included, void rows present). */
  activeTile: TileFilter;
  /** C4b (FR-010): FinancePage-owned void-row toggle; control in the right-hand group. */
  showVoidedInvoices: boolean;
  onShowVoidedInvoicesChange: (show: boolean) => void;
}

export const InvoiceWorkspace: React.FC<InvoiceWorkspaceProps> = ({ invoices, activeTile, showVoidedInvoices, onShowVoidedInvoicesChange }) => {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  // True while a fetchInvoice for the detail sidebar is in flight — drives the sidebar's loading shell
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false);
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

  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { organizationId } = useOrganization();
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
          setInvoiceDetailLoading(true);
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
      } finally {
        setInvoiceDetailLoading(false);
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
          setInvoiceDetailLoading(true);
          const inv = await fetchInvoice(invoiceId, organizationId);
          setSelectedInvoice(inv);
        }
      } catch {
        // Best-effort; list will still refresh
      } finally {
        setInvoiceDetailLoading(false);
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

    setInvoiceDetailLoading(true);
    fetchInvoice(invoiceId, organizationId)
      .then((inv) => setSelectedInvoice(inv))
      .catch(() => {})
      .finally(() => setInvoiceDetailLoading(false));
  }, [searchParams, selectedInvoice?.id, organizationId]);

  // Shared close for the detail sidebar (X button and backdrop click).
  const closeInvoiceSidebar = () => {
    setSelectedInvoice(null);
    // If the sidebar was opened via ?invoice=..., clear it so it doesn't immediately reopen.
    setSearchParams((prev) => {
      if (!prev.get('invoice')) return prev;
      const next = new URLSearchParams(prev);
      next.delete('invoice');
      next.delete('focus');
      return next;
    });
  };

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

  // Tile filter runs on RAW rows BEFORE the UI transform: classifyRowForFilter needs the
  // raw `status` ('pending'), and transformInvoicesForUI rewrites display status to
  // 'overdue'/'void'. Same classifier as FinancePage's tile counts (buildFinanceSummary),
  // so a tile's count equals its filtered row count by construction (SC-001).
  const tileFilteredInvoices = useMemo(() => {
    if (activeTile === 'all') return invoices;
    const today = new Date();
    return invoices.filter((invoice) => classifyRowForFilter(invoice, today) === activeTile);
  }, [invoices, activeTile]);

  // FR-012: default sort — due date ascending, on the tile-filtered RAW set, BEFORE the
  // transform and BEFORE search (search is an order-preserving filter, so sorting once
  // here keeps every downstream set ordered with no re-sort per keystroke; raw rows keep
  // due_date as canonical ISO, the classifier's own input). Rows with no reliable due
  // date sort LAST. sort() is stable (ES2019): equal due dates keep the fetch order —
  // created_at desc — as the secondary key. Header-click sorting stays out of scope
  // (backlog); the `sortable` flags remain decorative.
  const sortedInvoices = useMemo(() => {
    return [...tileFilteredInvoices].sort((a, b) => {
      const aRel = isReliableDueDate(a.due_date);
      const bRel = isReliableDueDate(b.due_date);
      if (aRel !== bRel) return aRel ? -1 : 1;
      if (!aRel) return 0;
      return String(a.due_date).slice(0, 10).localeCompare(String(b.due_date).slice(0, 10));
    });
  }, [tileFilteredInvoices]);

  // Transform invoices from DB format to UI format
  const uiInvoices = useMemo(
    () => transformInvoicesForUI(sortedInvoices),
    [sortedInvoices],
  );

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

  // Get visible columns in order. On mobile (<md), force-hide non-primary
  // columns so the table shows just Ref / Person / Amount / Status without
  // needing horizontal scroll. User's column preferences apply on desktop.
  const visibleColumns = useMemo(() => {
    return invoiceColumnDefinitions
      .filter(col => columnState.visibility[col.id] !== false)
      .filter(col => !isMobile || col.mobilePriority === 'primary')
      .sort((a, b) => {
        const aIndex = columnState.order.indexOf(a.id);
        const bIndex = columnState.order.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
  }, [columnState, isMobile]);

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

  // Tile filtering happened upstream (tileFilteredInvoices); search stays internal.
  // C4 (FR-013): amount matching added — substring of the formatted amount ("3,019" hits
  // "£3,019.20") or numeric equality to 2dp ("3019.20"; £/commas/spaces stripped before
  // parsing). Customer + invoice-number matching unchanged. Pure client filter, no refetch.
  const filteredInvoices = useMemo(() => {
    if (searchQuery === "") return uiInvoices;
    const q = searchQuery.toLowerCase();
    const stripped = searchQuery.replace(/[£,\s]/g, '');
    const qNum = stripped === '' ? NaN : Number(stripped);
    const qPence = Number.isFinite(qNum) ? Math.round(qNum * 100) : null;
    return uiInvoices.filter((invoice) => {
      if (invoice.customer.toLowerCase().includes(q)) return true;
      if (invoice.invoiceNumber.toLowerCase().includes(q)) return true;
      if (invoice.amount.toLowerCase().includes(q)) return true;
      if (qPence == null) return false;
      const amountNum = Number(invoice.amount.replace(/[£,]/g, ''));
      return Number.isFinite(amountNum) && Math.round(amountNum * 100) === qPence;
    });
  }, [uiInvoices, searchQuery]);

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

  // Focus collect payment section when coming from table "Partial" action
  useEffect(() => {
    const focus = searchParams.get('focus');
    const invoiceId = searchParams.get('invoice');
    if (focus !== 'collect' || !invoiceId) return;

    (async () => {
      try {
        if (organizationId) {
          setInvoiceDetailLoading(true);
          const inv = await fetchInvoice(invoiceId, organizationId);
          setSelectedInvoice(inv);
          setFocusCollectPayment(true);
        }
      } catch {
        // best-effort; sidebar may already have enough data
      } finally {
        setInvoiceDetailLoading(false);
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
    const dbInvoice = invoices.find((inv) => inv.id === invoice.id);
    if (dbInvoice) {
      setInvoiceToEdit(dbInvoice);
      setEditDrawerOpen(true);
    }
  };

  const handleDeleteInvoice = (invoice: UIInvoice) => {
    // Find the original DB invoice by ID
    const dbInvoice = invoices.find((inv) => inv.id === invoice.id);
    if (dbInvoice) {
      setInvoiceToDelete(dbInvoice);
      setDeleteDialogOpen(true);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-gardens-txs" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-gardens-surf2"
          />
        </div>
        <Button variant="outline" onClick={() => setColumnsDialogOpen(true)}>
          <Columns className="h-4 w-4 mr-2" />
          Columns
        </Button>
        <div className="flex gap-2 ml-auto items-center">
          {/* FR-010 (C4b): reveal voided invoices. State lives on FinancePage so the
              working set changes BEFORE bucketing (spec A-1). */}
          <div className="flex items-center gap-1.5">
            <Switch
              id="show-voided-invoices"
              checked={showVoidedInvoices}
              onCheckedChange={onShowVoidedInvoicesChange}
            />
            <Label htmlFor="show-voided-invoices" className="text-xs text-gardens-txs cursor-pointer whitespace-nowrap">
              Show voided
            </Label>
          </div>
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

      <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length === 0 ? (
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
                      // FR-011: dead Stripe paper dims — keyed on display status ('void',
                      // invoiceTransform.ts:69-75), the same predicate as the FR-018 badge,
                      // so a paid-then-voided row (settled, not dead paper) neither dims nor
                      // reads Void. Void rows reach the table only under 'all' by construction
                      // (classifyRowForFilter → isHubEligibleInvoice excludes them from every
                      // aging bucket, invoiceRemaining.ts:211) — no tile condition here.
                      // Opacity only: expand, sidebar, and row actions stay fully interactive.
                      <TableRow
                        key={invoice.id}
                        className={
                          invoice.status === 'void'
                            ? 'hover:bg-gardens-page opacity-60'
                            : 'hover:bg-gardens-page'
                        }
                      >
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
                              title={invoice.isLocked ? 'Invoice locked — use Revise invoice' : 'Edit invoice'}
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
                                if (organizationId) {
                                  setInvoiceDetailLoading(true);
                                  fetchInvoice(invoice.id, organizationId)
                                    .then(setSelectedInvoice)
                                    .catch(() => {})
                                    .finally(() => setInvoiceDetailLoading(false));
                                }
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
                        />
                      ),
                    ])}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
      </Card>

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
      {(selectedInvoice || invoiceDetailLoading) && (
        <div
          className="fixed inset-0 z-40 bg-black/10"
          onClick={closeInvoiceSidebar}
          aria-hidden
        />
      )}

      {/* Invoice Detail Sidebar */}
      <InvoiceDetailSidebar
        invoice={selectedInvoice}
        loading={invoiceDetailLoading}
        onClose={closeInvoiceSidebar}
        onReviseInvoice={(inv) => {
          setInvoiceToRevise(inv);
          setReviseModalOpen(true);
        }}
        onSelectInvoice={(id) => {
          if (organizationId) {
            setInvoiceDetailLoading(true);
            fetchInvoice(id, organizationId)
              .then(setSelectedInvoice)
              .catch(() => {})
              .finally(() => setInvoiceDetailLoading(false));
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
            setInvoiceDetailLoading(true);
            fetchInvoice(newId, organizationId)
              .then(setSelectedInvoice)
              .catch(() => {})
              .finally(() => setInvoiceDetailLoading(false));
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
