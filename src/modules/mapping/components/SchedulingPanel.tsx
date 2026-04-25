import React, { useMemo } from 'react';
import type { Order } from '@/modules/orders/types/orders.types';
import { DayCard } from './DayCard';
import { UnscheduledList } from './UnscheduledList';

interface SchedulingPanelProps {
  orders: Order[];
  scheduledDates: Map<string, string | null>;
  highlightedOrderId: string | null;
  onAssign: (orderId: string, date: string) => void;
  onUnassign: (orderId: string) => void;
  onHover: (orderId: string | null) => void;
}

export const SchedulingPanel: React.FC<SchedulingPanelProps> = ({
  orders,
  scheduledDates,
  highlightedOrderId,
  onAssign,
  onUnassign,
  onHover,
}) => {
  const { dayMap, unscheduled } = useMemo(() => {
    const dayMap = new Map<string, Order[]>();
    const unscheduled: Order[] = [];
    for (const o of orders) {
      const date = scheduledDates.get(o.id);
      if (!date) {
        unscheduled.push(o);
        continue;
      }
      const list = dayMap.get(date) ?? [];
      list.push(o);
      dayMap.set(date, list);
    }
    return { dayMap, unscheduled };
  }, [orders, scheduledDates]);

  const sortedDates = useMemo(
    () => [...dayMap.keys()].sort(),
    [dayMap]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 border-b border-zinc-200 bg-white">
        <UnscheduledList
          orders={unscheduled}
          highlightedOrderId={highlightedOrderId}
          onHover={onHover}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-50">
        {sortedDates.length === 0 && unscheduled.length > 0 && (
          <div className="text-center text-xs text-zinc-500 py-6">
            Click <span className="font-medium">Auto-schedule</span> to propose dates,
            or use a day card's add button.
          </div>
        )}
        {sortedDates.length === 0 && unscheduled.length === 0 && (
          <div className="text-center text-xs text-zinc-500 py-6">
            No orders to schedule yet.
          </div>
        )}
        {sortedDates.map((date) => (
          <DayCard
            key={date}
            date={date}
            orders={dayMap.get(date) ?? []}
            unscheduled={unscheduled}
            highlightedOrderId={highlightedOrderId}
            onAdd={(orderId) => onAssign(orderId, date)}
            onRemove={(orderId) => onUnassign(orderId)}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  );
};
