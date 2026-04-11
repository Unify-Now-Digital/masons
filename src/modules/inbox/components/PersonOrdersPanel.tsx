import React, { useEffect, useRef } from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Package, X } from 'lucide-react';
import { useOrdersByPersonId } from '@/modules/orders/hooks/useOrders';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { getOrderTotalFormatted } from '@/modules/orders/utils/orderCalculations';
import { formatOrderTypeLabel } from '@/modules/orders/utils/orderTypeDisplay';
import { OrderContextSummary } from '@/modules/inbox/components/OrderContextSummary';
import { InboxOrderListRow } from '@/modules/inbox/components/InboxOrderListRow';
import type { Order } from '@/modules/orders/types/orders.types';
import { cn } from '@/shared/lib/utils';
import { formatDateDMY } from '@/shared/lib/formatters';

interface PersonOrdersPanelProps {
  personId: string | null;
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  onCloseOrder: () => void;
  onOrdersCountChange?: (count: number) => void;
}

const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-slate-500';

export const PersonOrdersPanel: React.FC<PersonOrdersPanelProps> = ({
  personId,
  selectedOrderId,
  onSelectOrder,
  onCloseOrder,
  onOrdersCountChange,
}) => {
  const { data: orders = [], isLoading, error } = useOrdersByPersonId(personId);

  useEffect(() => {
    if (!isLoading) onOrdersCountChange?.(orders.length);
  }, [orders.length, isLoading, onOrdersCountChange]);

  const autoSelectedPersonRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !isLoading &&
      orders.length > 0 &&
      personId &&
      autoSelectedPersonRef.current !== personId
    ) {
      autoSelectedPersonRef.current = personId;
      onSelectOrder(orders[0].id);
    }
  }, [isLoading, orders, personId, onSelectOrder]);

  const displayOrder =
    orders.length > 0
      ? selectedOrderId
        ? orders.find((o) => o.id === selectedOrderId) ?? orders[0]
        : orders[0]
      : null;

  if (!personId) {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <p className="text-center text-slate-500 text-sm">
            Order context is available when a linked customer is selected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-slate-100/60">
      {/* ORDER CONTEXT header with optional close */}
      <div className="shrink-0 flex items-center justify-between gap-2 pb-2 px-3 pt-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <h2 className={cn(SECTION_LABEL, 'normal-case font-semibold text-slate-700')}>
            Order context {orders.length > 0 && `(${orders.length})`}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCloseOrder}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 focus:outline-none"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto scrollbar-hide px-3 py-3 space-y-3">
        {isLoading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-28 w-full rounded-xl bg-slate-200/80" />
            <Skeleton className="h-10 w-full rounded-lg bg-slate-200/80" />
            <Skeleton className="h-10 w-full rounded-lg bg-slate-200/80" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-600">
            {error instanceof Error ? error.message : 'Failed to load orders'}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-4">
            No orders for this person yet
          </div>
        ) : (
          <>
            {displayOrder && (
              <OrderContextSummary order={displayOrder} />
            )}
            <div className="space-y-1 pt-0.5">
              <p className={cn(SECTION_LABEL, 'px-0.5 mb-1.5')}>Orders</p>
              <div className="space-y-1">
                {orders.map((order) => (
                  <InboxOrderListRow
                    key={order.id}
                    orderId={getOrderDisplayId(order)}
                    description={
                      formatOrderTypeLabel(order.order_type) +
                      (order.due_date ? ` · Due ${formatDateDMY(order.due_date)}` : '')
                    }
                    amount={getOrderTotalFormatted(order)}
                    selected={selectedOrderId === order.id}
                    onClick={() => {
                      onSelectOrder(order.id);
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
