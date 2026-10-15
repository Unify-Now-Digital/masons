import React, { useMemo, useState } from 'react';
import { useProductsList } from '@/modules/products/hooks/useProducts';
import type { ColumnState } from '@/shared/tableViewPresets/types/tableViewPresets.types';
import { orderColumnDefinitions } from './orderColumnDefinitions';
import { OrdersBoard } from './OrdersBoard';
import type { UIOrder } from '../utils/orderTransform';
import { sortOrdersByMode, supplierEtaSortActive, type DefaultSortMode } from '../utils/orderDefaultSort';
import type { OrdersGroupBy } from '../utils/orderGroups';

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
  /** Toolbar group. Replaces the fixed Needs us / Waiting groups. */
  groupBy?: OrdersGroupBy;
  /** Toolbar sort used while no column header is clicked. */
  defaultSort?: DefaultSortMode;
  now?: Date;
}

export const SortableOrdersTable: React.FC<SortableOrdersTableProps> = ({
  orders,
  onViewOrder,
  onEditOrder,
  onDeleteOrder,
  columnState,
  onColumnStateChange,
  groupBy = 'priority',
  defaultSort = 'priority',
  now,
}) => {
  const clock = useMemo(() => now ?? new Date(), [now]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const { data: products = [] } = useProductsList();

  const productById = useMemo(() => {
    const map = new Map<string, { name: string; imageUrl: string | null }>();
    for (const product of products) {
      map.set(product.id, { name: product.name ?? '', imageUrl: product.image_url ?? null });
    }
    return map;
  }, [products]);

  const handleSort = (columnId: string) => {
    const column = orderColumnDefinitions.find((col) => col.id === columnId);
    if (!column?.sortable) return;
    setSortConfig((prev) => {
      if (prev?.key === columnId && prev.direction === 'asc') return { key: columnId, direction: 'desc' };
      return { key: columnId, direction: 'asc' };
    });
  };

  const sortedOrders = useMemo(() => {
    if (!sortConfig) return sortOrdersByMode(orders, defaultSort, clock);
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const value = (order: UIOrder): string | number => {
      switch (sortConfig.key) {
        case 'id': return order.order_number ?? order.id;
        case 'customer': return order.customer;
        case 'deceasedName': return order.deceasedName;
        case 'type': return order.type;
        case 'stoneStatus': return order.stoneStatus;
        case 'supplier': {
          const supplier = order.supplier;
          if (supplier?.deliveryDate) return `0${supplier.deliveryDate}`;
          const batch = supplier?.batchCodes?.find(Boolean);
          if (batch || supplier?.deliveryEstimate) return `1${batch ?? ''}|${supplier?.deliveryEstimate ?? ''}`;
          if (supplier && supplier.kind !== 'none') return '2';
          return '3';
        }
        case 'progress': return order.progress;
        case 'value': return order.total;
        case 'dueDate': return order.dueDate || '';
        default: return '';
      }
    };
    return [...orders].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'en-GB') * dir;
    });
  }, [orders, sortConfig, defaultSort, clock]);

  return (
    <OrdersBoard
      orders={sortedOrders}
      columnState={columnState}
      onColumnStateChange={onColumnStateChange}
      groupBy={supplierEtaSortActive(defaultSort, sortConfig?.key ?? null) ? 'none' : groupBy}
      now={clock}
      onViewOrder={onViewOrder}
      onEditOrder={onEditOrder}
      onDeleteOrder={onDeleteOrder}
      onSort={handleSort}
      sortDirection={(columnId) => (sortConfig?.key === columnId ? sortConfig.direction : null)}
      productById={productById}
    />
  );
};

export default SortableOrdersTable;
