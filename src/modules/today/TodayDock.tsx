import React from 'react';
import { PersonOrdersPanel } from '@/modules/inbox/components/PersonOrdersPanel';
import { OrderContextPanel } from '@/modules/orders/components/OrderContextPanel';
import { useOrder } from '@/modules/orders/hooks/useOrders';
import type { TodayItem } from './todayModel';
import { dockBlockerFor, type DockBlocker } from './dockBlocker';
import { useRecentActivity } from './useRecentActivity';

const SHELL = 'flex h-full min-h-0 flex-col overflow-auto border-l bg-gardens-surf';

/**
 * The third Today column. An order opens the order panel in-flow.
 * Anything else opens the person panel in-flow. Both follow the selected row.
 */
export const TodayDock: React.FC<{
  item: TodayItem;
  customer: boolean;
  onOpenFull: () => void;
}> = ({ item, customer, onOpenFull }) => {
  const { events } = useRecentActivity(item.personId ?? null, item.orderId ?? null, item.conversationId ?? null);
  if (item.orderId) {
    return (
      <OrderDock
        orderId={item.orderId}
        itemKey={item.key}
        blocker={dockBlockerFor(item)}
        channel={item.channel}
        events={events}
        onOpenFull={onOpenFull}
      />
    );
  }
  return (
    <div data-testid="today-dock" data-key={item.personId ?? item.key} data-variant="docked" className="h-full min-h-0">
      <PersonOrdersPanel
        variant="docked"
        personId={item.personId ?? null}
        conversationIds={item.conversationId ? [item.conversationId] : []}
        selectedJobId={null}
        selectedOrderId={null}
        onSelectOrder={() => {}}
        onCloseOrder={() => {}}
        hideClose
        activity={events}
        onOpenFull={onOpenFull}
        kindLabel={customer ? 'Customer' : 'Enquiry'}
        channel={item.channel}
      />
    </div>
  );
};

const OrderDock: React.FC<{
  orderId: string;
  itemKey: string;
  blocker: DockBlocker;
  channel?: string | null;
  events: ReturnType<typeof useRecentActivity>['events'];
  onOpenFull: () => void;
}> = ({ orderId, itemKey, blocker, channel, events, onOpenFull }) => {
  const order = useOrder(orderId);
  if (!order.data) {
    return <aside data-testid="today-dock" data-key={itemKey} data-variant="docked" className={SHELL} />;
  }
  return (
    <div data-testid="today-dock" data-key={itemKey} className="h-full min-h-0">
      <OrderContextPanel
        variant="docked"
        order={order.data}
        dockBlocker={blocker}
        channel={channel}
        activity={events}
        onOpenFull={onOpenFull}
      />
    </div>
  );
};
