import React, { useState, useRef, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Edit, Trash2 } from 'lucide-react';
import { useMessageCountsByOrders } from '@/modules/inbox/hooks/useMessages';
import { orderColumnDefinitions } from './orderColumnDefinitions';
import type { UIOrder } from '../utils/orderTransform';
import type { ColumnState } from '@/shared/tableViewPresets/types/tableViewPresets.types';

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
}

export const SortableOrdersTable: React.FC<SortableOrdersTableProps> = ({ 
  orders, 
  onOrderUpdate, 
  onViewOrder, 
  onEditOrder, 
  onDeleteOrder,
  columnState,
  onColumnStateChange,
}) => {
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

  // Get visible columns in order
  const visibleColumns = React.useMemo(() => {
    return orderColumnDefinitions
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

  const sortedOrders = React.useMemo(() => {
    if (!sortConfig) return orders;

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
          aValue = a.type;
          bValue = b.type;
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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {visibleColumns.map((column) => {
              const width = columnState.widths[column.id] || column.defaultWidth;
              const sortDirection = getSortDirection(column.id);
              
              return (
                <TableHead 
                  key={column.id} 
                  className="relative"
                  style={{ width: `${width}px`, minWidth: `${width}px` }}
                >
                  {column.renderHeader({
                    onSort: column.sortable ? () => handleSort(column.id) : undefined,
                    sortDirection,
                  })}
                  {onColumnStateChange && (
                    <div
                      ref={resizeRef}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500 bg-transparent"
                      onMouseDown={(e) => handleResizeStart(column.id, e)}
                      style={{ zIndex: 10 }}
                    />
                  )}
                </TableHead>
              );
            })}
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrders.map((order) => {
            const daysUntilDue = getDaysUntilDue(order.dueDate);
            return (
              <TableRow key={order.id} className="hover:bg-slate-50">
                {visibleColumns.map((column) => {
                  const width = columnState.widths[column.id] || column.defaultWidth;
                  const cell = column.renderCell(order, {
                    messageCount: messageCountMap[order.id] || 0,
                    isLoadingCounts,
                    daysUntilDue,
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
                  <div className="flex items-center gap-2">
                    {onViewOrder && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onViewOrder(order)}
                      >
                        View
                      </Button>
                    )}
                    {onEditOrder && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onEditOrder(order)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDeleteOrder && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onDeleteOrder(order)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default SortableOrdersTable;
