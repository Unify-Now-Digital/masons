import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Search, Plus, Eye, Edit, Trash2, Columns, ChevronLeft, ChevronRight } from 'lucide-react';
import { invoicesKeys } from '../hooks/useInvoices';
import { transformInvoicesForUI, type UIInvoice } from '../utils/invoiceTransform';
import {
  classifyRowForFilter,
  isReliableDueDate,
  isStatFilter,
  matchesStatFilter,
  type ActiveFilter,
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
import { formatGbpPence } from '@/shared/lib/formatters';

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

// C9 (FR-033): client-side page sizes; default 25, persisted per browser in its own
// localStorage key beside the column state. Invalid/missing stored values fall back.
const PAGE_SIZES = [10, 25, 50] as const;
type PageSize = (typeof PAGE_SIZES)[number];
const DEFAULT_PAGE_SIZE: PageSize = 25;
const PAGE_SIZE_STORAGE_KEY = 'invoices_page_size';

const readStoredPageSize = (): PageSize => {
  try {
    const stored = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    return (PAGE_SIZES as readonly number[]).includes(stored)
      ? (stored as PageSize)
      : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
};

// C9 (FR-035, ruled at approval): min-height covers min(pageSize, total) rows — page
// flips within a set never change the card height, and a set shorter than a page gets
// no blank tail (none at all when total is 0). Row = TableCell p-4 (16+16) + tallest
// content (size="sm" buttons, h-9 = 36px) + 1px border = 69px; header h-12 + 1px = 49px.
const ROW_HEIGHT_PX = 69;
const HEADER_HEIGHT_PX = 49;

interface InvoiceWorkspaceProps {
  /** Unified working set (post enquiry-hiding, FinancePage-owned), RAW DB rows. */
  invoices: Invoice[];
  /** The only list filter (FR-002/FR-026): a chip (TileFilter) or a stat (StatFilter), one
   *  at a time, FinancePage-owned; 'all' = no filter (paid included, void rows present). */
  activeFilter: ActiveFilter;
  /** C4b (FR-010): FinancePage-owned void-row toggle; control in the right-hand group. */
  showVoidedInvoices: boolean;
  onShowVoidedInvoicesChange: (show: boolean) => void;
  /** C4c: chip data computed by FinancePage (single source) — workspace renders, never computes. */
  tiles: {
    items: { key: TileFilter; label: string; count: number; totalPence: number }[];
    allZero: boolean;
  };
  /** C4c: chip click (toggle-back-to-All logic lives on FinancePage). */
  onActiveTileChange: (tile: TileFilter) => void;
}

export const InvoiceWorkspace: React.FC<InvoiceWorkspaceProps> = ({ invoices, activeFilter, tiles, onActiveTileChange, showVoidedInvoices, onShowVoidedInvoicesChange }) => {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  // C8 (FR-031): collapsed/expanded state of the search control; text state unchanged.
  const [searchOpen, setSearchOpen] = useState(false);
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
  // C9 (FR-033/FR-036): 1-based page over filteredInvoices; size read once on mount.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(readStoredPageSize);
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
    if (activeFilter === 'all') return invoices;
    const today = new Date();
    // C7 (FR-027): stat filters share classifyRowForFilter's family via matchesStatFilter —
    // never a second classifier here.
    if (isStatFilter(activeFilter)) {
      return invoices.filter((invoice) => matchesStatFilter(invoice, activeFilter, today));
    }
    return invoices.filter((invoice) => classifyRowForFilter(invoice, today) === activeFilter);
  }, [invoices, activeFilter]);

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

  // C9 (FR-033): paging is a slice at THIS boundary — everything below (rows, expand,
  // actions) reads pagedInvoices; nothing above (filter, sort, transform, search,
  // summary) knows paging exists. The table is never remounted by a page change.
  const pageCount = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  // Derived clamp (no second effect): a shrink can never render an out-of-range page.
  const safePage = Math.min(page, pageCount);
  const pagedInvoices = useMemo(
    () => filteredInvoices.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredInvoices, safePage, pageSize],
  );
  const tableMinHeight = HEADER_HEIGHT_PX + Math.min(pageSize, filteredInvoices.length) * ROW_HEIGHT_PX;

  // C9 (FR-036): back to page 1 on any user-driven change of the working set — filter,
  // search, void toggle, page size. Keyed on the INPUTS, not filteredInvoices identity,
  // so a background refetch never resets paging; the safePage clamp covers shrinkage.
  useEffect(() => {
    setPage(1);
  }, [activeFilter, searchQuery, showVoidedInvoices, pageSize]);

  // C9 (FR-038): expanded rows collapse when the visible page changes.
  useEffect(() => {
    setExpandedInvoices(new Set());
  }, [safePage]);

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
    } catch {
      // best-effort persistence
    }
  };

  // Deep-link/open invoice sidebar: ?invoice=<id> → open sidebar (used by Inbox "Open
  // invoice"). C9 (FR-037): lives below filteredInvoices (and the page-1 reset, so its
  // setPage wins the same flush) to jump to the target's page before opening. The ref
  // makes the jump fire ONCE per invoiceId — a refetch can't snap the page back while
  // ?invoice= stays in the URL; clearing the param re-arms it. A target absent from the
  // filtered set keeps the old behaviour: sidebar opens, the list doesn't move.
  const lastPageJumpInvoiceIdRef = useRef<string | null>(null);
  useEffect(() => {
    const invoiceId = searchParams.get('invoice');
    const focus = searchParams.get('focus');
    const pay = searchParams.get('pay');
    const stripe = searchParams.get('stripe');

    if (!invoiceId) {
      // Param gone (sidebar closed) — re-arm the once-per-id page jump.
      lastPageJumpInvoiceIdRef.current = null;
      return;
    }
    // Avoid clashing with other redirect flows handled elsewhere.
    if (!organizationId) return;
    if (pay === 'success') return;
    if (stripe === 'success') return;
    if (focus === 'collect') return;

    if (lastPageJumpInvoiceIdRef.current !== invoiceId) {
      const targetIndex = filteredInvoices.findIndex((inv) => inv.id === invoiceId);
      if (targetIndex >= 0) {
        setPage(Math.floor(targetIndex / pageSize) + 1);
        lastPageJumpInvoiceIdRef.current = invoiceId;
      }
    }

    if (selectedInvoice?.id === invoiceId) return;

    setInvoiceDetailLoading(true);
    fetchInvoice(invoiceId, organizationId)
      .then((inv) => setSelectedInvoice(inv))
      .catch(() => {})
      .finally(() => setInvoiceDetailLoading(false));
  }, [searchParams, selectedInvoice?.id, organizationId, filteredInvoices, pageSize]);

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
      {/* C8 toolbar (FR-030..FR-032): chips + voided chip-toggle | (ml-auto) search, Columns, Create.
          flex-wrap: at 1280 the chip row (incl. the voided chip) wraps above the right-hand group. */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
        <div className="flex items-center gap-1.5 flex-wrap">
          {tiles.items.map(({ key, label, count, totalPence }) => {
            // C7 (FR-026): a chip renders selected only when the ONE active filter is that
            // TileFilter — an active stat matches no chip key, so every chip deselects.
            const active = activeFilter === key;
            const clickable = key === 'all' || count > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onActiveTileChange(key)}
                disabled={!clickable}
                title={key !== 'all' && totalPence > 0 ? formatGbpPence(totalPence) : undefined}
                className="text-[12px] font-semibold rounded-full px-3 py-1 transition-colors whitespace-nowrap"
                style={{
                  // Selected-chip pattern per PipelinePage.tsx:100-102 (acc-lt bg + acc border).
                  background: active ? 'var(--g-acc-lt)' : 'transparent',
                  border: `1px solid ${active ? 'var(--g-acc)' : clickable ? 'var(--g-bdr)' : 'transparent'}`,
                  color: active ? 'var(--g-acc-dk)' : clickable ? 'var(--g-tx)' : 'var(--g-txm)',
                  cursor: clickable ? 'pointer' : 'default',
                }}
              >
                {label} <span style={{ color: active ? 'var(--g-acc-dk)' : 'var(--g-txm)' }}>{count}</span>
              </button>
            );
          })}
          {/* FR-030: "Show voided" as a chip-toggle ending the chip row, set off by a divider
              so it reads as a toggle, not a sixth bucket. Same pill geometry + PipelinePage.tsx
              :100-102 pairing; state FinancePage-owned, applied pre-bucketing (spec A-1) —
              only the control changed (was Switch + Label). */}
          <span className="ml-2 pl-3 border-l" style={{ borderColor: 'var(--g-bdr)' }}>
            <button
              type="button"
              onClick={() => onShowVoidedInvoicesChange(!showVoidedInvoices)}
              aria-pressed={showVoidedInvoices}
              className="text-[12px] font-semibold rounded-full px-3 py-1 transition-colors whitespace-nowrap"
              style={{
                background: showVoidedInvoices ? 'var(--g-acc-lt)' : 'transparent',
                border: `1px solid ${showVoidedInvoices ? 'var(--g-acc)' : 'var(--g-bdr)'}`,
                color: showVoidedInvoices ? 'var(--g-acc-dk)' : 'var(--g-tx)',
                cursor: 'pointer',
              }}
            >
              Show voided
            </button>
          </span>
          {tiles.allZero && (
            <span className="text-[11px] text-gardens-txs whitespace-nowrap">
              All invoices are paid up. Nothing to chase.
            </span>
          )}
        </div>
        <div className="flex gap-2 ml-auto items-center">
          {/* FR-031: search collapses to an icon-only button; expands on click/focus with
              autofocus; Escape clears + collapses; blur collapses only when empty.
              searchQuery + predicate untouched. */}
          {searchOpen || searchQuery !== '' ? (
            <div className="relative w-64">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gardens-txs" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => { if (searchQuery === '') setSearchOpen(false); }}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return;
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
                autoFocus
                className="pl-9 bg-gardens-surf2"
              />
            </div>
          ) : (
            <Button
              variant="outline"
              size="icon"
              title="Search"
              aria-label="Search invoices"
              onClick={() => setSearchOpen(true)}
              onFocus={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="icon" title="Columns" aria-label="Columns" onClick={() => setColumnsDialogOpen(true)}>
            <Columns className="h-4 w-4" />
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
                <div className="overflow-x-auto min-w-0" style={{ minHeight: tableMinHeight }}>
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
                    {pagedInvoices.map((invoice) => [
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
              {/* C9 (FR-034): pager inside the card, below the table. Count text always
                  renders; Prev/Next only when there is more than one page. */}
              <InvoicePager
                page={safePage}
                pageSize={pageSize}
                total={filteredInvoices.length}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
              />
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

// C9 (FR-034): pager built from ui/ Button + Select — no pagination primitive exists in
// the repo (verified 2026-09-02). Module-level so its element type is stable across
// renders. Internal to this file; no new cross-boundary props (stat-filter-props.md).
interface InvoicePagerProps {
  /** 1-based; pre-clamped by the caller. */
  page: number;
  pageSize: PageSize;
  /** filteredInvoices.length — the full filtered + sorted set, not the slice. */
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

const InvoicePager: React.FC<InvoicePagerProps> = ({ page, pageSize, total, onPageChange, onPageSizeChange }) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-end gap-2 pt-4">
      <span className="text-sm text-gardens-txs whitespace-nowrap">
        {total === 0 ? '0 of 0' : `${start}–${end} of ${total}`}
      </span>
      <Select
        value={String(pageSize)}
        onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}
      >
        <SelectTrigger className="h-9 w-[72px]" aria-label="Rows per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pageCount > 1 && (
        <>
          <Button variant="outline" size="sm" disabled={page <= 1} aria-label="Previous page" onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pageCount} aria-label="Next page" onClick={() => onPageChange(page + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
};
