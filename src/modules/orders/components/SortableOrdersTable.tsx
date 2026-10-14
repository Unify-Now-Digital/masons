import React, { useState, useRef, useCallback } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Edit, Eye, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { NextActionPill } from '@/shared/components/mason';
import { groupOrdersByNextAction, isGroupCollapsedByDefault, orderNextAction, ORDER_GROUP_LABEL, type OrderActionGroup } from '../utils/orderNextAction';
import { sortOrdersByStoneThenAge } from '../utils/orderDefaultSort';
import { ChevronRight as GroupChevron } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useMessageCountsByOrders } from '@/modules/inbox/hooks/useMessages';
import { useProductsList } from '@/modules/products/hooks/useProducts';
import { orderColumnDefinitions } from './orderColumnDefinitions';
import type { UIOrder } from '../utils/orderTransform';
import { formatOrderTypeLabel } from '../utils/orderTypeDisplay';
import type { ColumnState } from '@/shared/tableViewPresets/types/tableViewPresets.types';
import { useIsMobile } from '@/shared/hooks/use-mobile';

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface SortableOrdersTableProps {
  orders: UIOrder[];
  onOrderUpdate?: (orderId: string, updates: Partial<UIOrder>) => void;
  onViewOrder?: (order: UIOrder) => void;
  onEditOrder?: (order: UIOrder) => void;
  onDeleteOrder?: (order: UIOrder) => void;
  columnState: ColumnState;
  onColumnStateChange?: (state: ColumnState) => void;
  columnFilters?: Record<string, string[]>;
  onColumnFilterChange?: (columnId: string, values: string[]) => void;
  filterOptions?: Record<string, { value: string; label: string }[]>;
  /** Split rows into "Needs us" / "Waiting on others" / "Nothing due" (sort order kept inside each group). */
  groupByNextAction?: boolean;
}

export const SortableOrdersTable: React.FC<SortableOrdersTableProps> = ({ 
  orders, 
  onOrderUpdate, 
  onViewOrder, 
  onEditOrder, 
  onDeleteOrder,
  columnState,
  onColumnStateChange,
  columnFilters,
  onColumnFilterChange,
  filterOptions,
  groupByNextAction = false,
}) => {
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<OrderActionGroup>>(
    () => new Set((['needs_us', 'waiting', 'nothing_due'] as const).filter(isGroupCollapsedByDefault)),
  );
  const toggleGroup = (key: OrderActionGroup) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const isMobile = useIsMobile();
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Extract order IDs for batch fetching
  const orderIds = React.useMemo(() => orders.map(order => order.id), [orders]);
  
  // Batch fetch message counts for all orders
  const { data: messageCounts, isLoading: isLoadingCounts } = useMessageCountsByOrders(orderIds);
  
  // Create lookup map for O(1) access
  const messageCountMap = React.useMemo(() => {
    return messageCounts || {};
  }, [messageCounts]);

  const { data: products = [] } = useProductsList();
  const catalogPhotoByName = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) {
      const key = (p.name ?? '').trim().toLowerCase();
      if (key && p.image_url) m.set(key, p.image_url);
    }
    return m;
  }, [products]);

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return Infinity;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleSort = (columnId: string) => {
    const column = orderColumnDefinitions.find(col => col.id === columnId);
    if (!column || !column.sortable) return;

    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === columnId && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: columnId, direction });
  };

  const getSortDirection = (columnId: string): 'asc' | 'desc' | null => {
    if (!sortConfig || sortConfig.key !== columnId) return null;
    return sortConfig.direction;
  };

  const getFilterProps = (columnId: string) => {
    if (!onColumnFilterChange || !filterOptions?.[columnId]) return undefined;
    return {
      options: filterOptions[columnId],
      selected: columnFilters?.[columnId] ?? [],
      onChange: (values: string[]) => onColumnFilterChange(columnId, values),
    };
  };

  // Get visible columns in order. On mobile (<md), force-hide non-primary
  // columns so the table shows just Ref / Customer / Age without needing
  // horizontal scroll. User's column preferences still apply on desktop.
  const visibleColumns = React.useMemo(() => {
    return orderColumnDefinitions
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
  }, [columnState]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const computeNextOrderPreservingHidden = useCallback(
    (fullOrder: string[], visibleIds: string[], activeId: string, overId: string) => {
      if (activeId === overId) return fullOrder;

      // Normalize state for drag calculation:
      // - Start from persisted `columnState.order` (fullOrder)
      // - Append any visible-but-missing ids at the end in the current UI order
      // This prevents a strict no-op when a visible column id is not present in `columnState.order`.
      const safeFullOrder = [...fullOrder];
      for (const id of visibleIds) {
        if (!safeFullOrder.includes(id)) safeFullOrder.push(id);
      }

      const visibleSet = new Set(visibleIds);
      const visibleInFullOrder = safeFullOrder.filter((id) => visibleSet.has(id));

      // If the state is inconsistent (ids missing), do a safe no-op.
      if (visibleInFullOrder.length !== visibleIds.length) return fullOrder;

      const oldIndex = visibleInFullOrder.indexOf(activeId);
      const newIndex = visibleInFullOrder.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return fullOrder;

      const movedVisibleIds = arrayMove(visibleInFullOrder, oldIndex, newIndex);

      // Rebuild full order by replacing only visible ids in their existing slots.
      let movedIndex = 0;
      return safeFullOrder.map((id) => {
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
      if (!onColumnStateChange) return;
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

      // Avoid unnecessary state updates.
      const changed =
        nextOrder.length !== fullOrder.length ||
        nextOrder.some((id, i) => id !== fullOrder[i]);
      if (!changed) return;

      onColumnStateChange({
        ...columnState,
        order: nextOrder,
      });
    },
    [onColumnStateChange, isMobile, columnState, visibleColumns, computeNextOrderPreservingHidden]
  );

  const SortableHeaderCell: React.FC<{
    column: (typeof visibleColumns)[number];
    width: number;
    sortDirection: 'asc' | 'desc' | null;
  }> = ({ column, width, sortDirection }) => {
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
        className="relative overflow-hidden"
        style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
      >
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          onClick={column.sortable ? () => handleSort(column.id) : undefined}
          className={`h-full pr-1 flex items-center min-w-0 overflow-hidden whitespace-nowrap${column.sortable ? ' cursor-pointer select-none' : ''}`}
        >
          {column.renderHeader({
            onSort: column.sortable ? () => handleSort(column.id) : undefined,
            sortDirection,
            filter: getFilterProps(column.id),
          })}
        </div>
        {onColumnStateChange && (
          <div
            ref={resizeRef}
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-gardens-blu bg-transparent"
            onMouseDown={(e) => handleResizeStart(column.id, e)}
            style={{ zIndex: 10 }}
          />
        )}
      </TableHead>
    );
  };

  const sortedOrders = React.useMemo(() => {
    if (!sortConfig) return sortOrdersByStoneThenAge(orders);

    return [...orders].sort((a, b) => {
      const column = orderColumnDefinitions.find(col => col.id === sortConfig.key);
      if (!column) return 0;

      let aValue: string | number | null | undefined;
      let bValue: string | number | null | undefined;

      // Map column ID to order property
      switch (sortConfig.key) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'customer':
          aValue = a.customer;
          bValue = b.customer;
          break;
        case 'deceasedName':
          aValue = a.deceasedName;
          bValue = b.deceasedName;
          break;
        case 'type':
          aValue = formatOrderTypeLabel(a.type);
          bValue = formatOrderTypeLabel(b.type);
          break;
        case 'stoneStatus':
          aValue = a.stoneStatus;
          bValue = b.stoneStatus;
          break;
        case 'progress':
          aValue = a.progress;
          bValue = b.progress;
          break;
        case 'depositDate':
          aValue = a.depositDate;
          bValue = b.depositDate;
          break;
        case 'installationDate':
          aValue = a.installationDate;
          bValue = b.installationDate;
          break;
        case 'dueDate':
          aValue = a.dueDate;
          bValue = b.dueDate;
          break;
        case 'value':
          // Sort by numeric total, not formatted string
          aValue = a.total;
          bValue = b.total;
          break;
        default:
          return 0;
      }

      // Handle numeric sorting
      if (sortConfig.key === 'progress' || sortConfig.key === 'value') {
        return sortConfig.direction === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }

      // Handle date sorting
      if (sortConfig.key === 'dueDate' || sortConfig.key === 'depositDate' || sortConfig.key === 'installationDate') {
        const aDate = new Date(aValue as string);
        const bDate = new Date(bValue as string);
        return sortConfig.direction === 'asc' 
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      // Handle string sorting
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortConfig.direction === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
  }, [orders, sortConfig]);

  // Column resizing handlers
  const handleResizeStart = useCallback((columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnId);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnState.widths[columnId] || orderColumnDefinitions.find(col => col.id === columnId)?.defaultWidth || 100);
  }, [columnState.widths]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn || !onColumnStateChange) return;

    const diff = e.clientX - resizeStartX;
    const newWidth = Math.max(50, resizeStartWidth + diff);

    onColumnStateChange({
      ...columnState,
      widths: {
        ...columnState.widths,
        [resizingColumn]: newWidth,
      },
    });
  }, [resizingColumn, resizeStartX, resizeStartWidth, columnState, onColumnStateChange]);

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
  }, []);

  React.useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);

  return (
    <div className="rounded-lg border bg-gardens-surf shadow-sm">
      {/* Dense cells (space pass 2026-10-14): p-4 → px-2.5 py-1.5 so ~2x rows fit at 800px. */}
      <Table className="[&_td]:px-2.5 [&_td]:py-1.5 [&_th]:px-2.5 [&_th]:h-9">
        <TableHeader>
          <TableRow>
            {isMobile ? (
              visibleColumns.map((column) => {
                const width = columnState.widths[column.id] || column.defaultWidth;
                const sortDirection = getSortDirection(column.id);
                return (
                  <TableHead
                    key={column.id}
                    className="relative"
                    style={{ width: `${width}px`, minWidth: `${width}px` }}
                  >
                    <div
                      onClick={column.sortable ? () => handleSort(column.id) : undefined}
                      className={`flex items-center${column.sortable ? ' cursor-pointer select-none' : ''}`}
                    >
                      {column.renderHeader({
                        onSort: column.sortable ? () => handleSort(column.id) : undefined,
                        sortDirection,
                        filter: getFilterProps(column.id),
                      })}
                    </div>
                    {onColumnStateChange && (
                      <div
                        ref={resizeRef}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-gardens-blu bg-transparent"
                        onMouseDown={(e) => handleResizeStart(column.id, e)}
                        style={{ zIndex: 10 }}
                      />
                    )}
                  </TableHead>
                );
              })
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleHeaderDragEnd}
                // Render dnd-kit's a11y live region outside the <tr>: inside it the two
                // divs became an anonymous table cell that pushed the header one column
                // out of line with the body (and widened the table by ~200px).
                accessibility={{ container: typeof document !== 'undefined' ? document.body : undefined }}
              >
                <SortableContext
                  items={visibleColumns.map((c) => c.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {visibleColumns.map((column) => {
                    const width = columnState.widths[column.id] || column.defaultWidth;
                    const sortDirection = getSortDirection(column.id);
                    return (
                      <SortableHeaderCell
                        key={column.id}
                        column={column}
                        width={width}
                        sortDirection={sortDirection}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            )}
            <TableHead style={{ width: 196, minWidth: 196 }}>Next step</TableHead>
            <TableHead
              className="sticky right-0 z-30 bg-gardens-surf border-l border-gardens-bdr shadow-[-6px_0_8px_rgba(26,24,21,0.06)]"
              style={{ width: 100, minWidth: 100 }}
            >
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(groupByNextAction ? groupOrdersByNextAction(sortedOrders) : [{ key: 'all' as const, orders: sortedOrders }]).flatMap((group) => [
            ...(group.key === 'all'
              ? []
              : [
                  <TableRow key={`group-${group.key}`} className="bg-gardens-page hover:bg-gardens-page" data-testid={`orders-group-${group.key}`}>
                    <TableCell
                      colSpan={visibleColumns.length + 2}
                      className="py-1 px-4 text-[11px] font-bold uppercase tracking-[0.06em] text-gardens-txs"
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase"
                        aria-expanded={!collapsedGroups.has(group.key)}
                        onClick={() => toggleGroup(group.key)}
                      >
                        <GroupChevron
                          className={cn('h-3 w-3 transition-transform', !collapsedGroups.has(group.key) && 'rotate-90')}
                          aria-hidden
                        />
                        {ORDER_GROUP_LABEL[group.key]}
                        <span className="ml-1 normal-case tracking-normal font-medium text-gardens-txm-aa">{group.orders.length}</span>
                      </button>
                    </TableCell>
                  </TableRow>,
                ]),
            ...(group.key !== 'all' && collapsedGroups.has(group.key) ? [] : group.orders).map((order) => {
            const daysUntilDue = getDaysUntilDue(order.dueDate);
            const now = new Date();
            const resolvedPhotoUrl =
              order.productPhotoUrl ?? catalogPhotoByName.get((order.sku ?? '').trim().toLowerCase()) ?? null;
            return (
              <TableRow
                key={order.id}
                className={cn('hover:bg-gardens-page', onViewOrder && 'cursor-pointer')}
                onClick={onViewOrder ? () => onViewOrder(order) : undefined}
              >
                {visibleColumns.map((column) => {
                  const width = columnState.widths[column.id] || column.defaultWidth;
                  const cell = column.renderCell(order, {
                    messageCount: messageCountMap[order.id] || 0,
                    isLoadingCounts,
                    daysUntilDue,
                    now,
                    productPhotoUrl: resolvedPhotoUrl,
                  });
                  
                  // Apply width to the cell
                  if (React.isValidElement<{ style?: React.CSSProperties }>(cell)) {
                    return React.cloneElement(cell, {
                      key: column.id,
                      style: {
                        ...(cell.props.style ?? {}),
                        width: `${width}px`,
                        minWidth: `${width}px`,
                        maxWidth: `${width}px`,
                      },
                    });
                  }
                  return cell;
                })}
                {(() => {
                  const action = orderNextAction(order);
                  return (
                    <TableCell style={{ width: 196, minWidth: 196 }}>
                      {action.kind === 'none' ? (
                        <span className="text-xs text-gardens-txm-aa">Nothing due</span>
                      ) : (
                        <div className="flex flex-col items-start gap-0.5">
                          <NextActionPill action={action} />
                          <span
                            className={cn(
                              'text-[11px] truncate max-w-[180px]',
                              action.tone === 'red' ? 'text-gardens-sem-red' : action.tone === 'amber' ? 'text-gardens-sem-amber' : 'text-gardens-txs',
                            )}
                            title={action.reason}
                          >
                            {action.reason}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  );
                })()}
                <TableCell
                  className="sticky right-0 z-20 bg-gardens-surf border-l border-gardens-bdr shadow-[-6px_0_8px_rgba(26,24,21,0.06)]"
                  style={{ width: 100, minWidth: 100 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    {onViewOrder && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="View order"
                        onClick={(e) => { e.stopPropagation(); onViewOrder(order); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {onEditOrder && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={order.invoiceLocked}
                        title={order.invoiceLocked ? 'Invoice locked — use Revise invoice' : 'Edit order'}
                        onClick={(e) => { e.stopPropagation(); onEditOrder(order); }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDeleteOrder && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="More actions"
                            aria-label={`More actions for order ${order.order_number ?? order.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {/* Delete moved off the row into ⋯ (risk 4); DeleteOrderDialog still confirms. */}
                          <DropdownMenuItem
                            onSelect={() => onDeleteOrder(order)}
                            className="text-gardens-red-dk focus:text-gardens-red-dk focus:bg-gardens-red-lt"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          }),
          ])}
        </TableBody>
      </Table>
    </div>
  );
};

export default SortableOrdersTable;
