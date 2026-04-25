import React from 'react';
import type { Order } from '@/modules/orders/types/orders.types';
import { isKerb } from '../utils/jobTypeClassifier';

interface UnscheduledListProps {
  orders: Order[];
  highlightedOrderId: string | null;
  onHover: (orderId: string | null) => void;
}

export const UnscheduledList: React.FC<UnscheduledListProps> = ({
  orders,
  highlightedOrderId,
  onHover,
}) => {
  if (orders.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-xs text-zinc-500 text-center">
        All schedulable jobs are placed.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-2">
      <div className="text-xs font-medium text-zinc-700 px-1 pb-1">
        Unscheduled ({orders.length})
      </div>
      <div className="max-h-40 overflow-y-auto space-y-0.5">
        {orders.map((o) => (
          <div
            key={o.id}
            onMouseEnter={() => onHover(o.id)}
            onMouseLeave={() => onHover(null)}
            className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
              highlightedOrderId === o.id ? 'bg-amber-50 ring-1 ring-amber-300' : 'hover:bg-zinc-50'
            }`}
          >
            <span
              className={`inline-block w-2.5 h-2.5 flex-shrink-0 ${
                isKerb(o) ? 'rounded-sm bg-emerald-700' : 'rounded-full bg-amber-600'
              }`}
            />
            <span className="truncate">
              <span className="font-medium text-zinc-900">{o.customer_name}</span>
              {' · '}
              <span className="text-zinc-600">{o.location}</span>
              {' · '}
              <span className="text-zinc-500">{o.order_type}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
