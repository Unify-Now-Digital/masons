import React from 'react';
import type { PermitOrder } from '../types/permitTracker.types';
import { PERMIT_SECTIONS } from '../types/permitTracker.types';
import { groupOrdersBySection } from '../utils/permitDays';
import { PermitCard } from './PermitCard';

interface ActionQueueViewProps {
  orders: PermitOrder[];
  onChase: (order: PermitOrder, target: 'cemetery' | 'customer') => void;
  onLogNote: (order: PermitOrder) => void;
}

export function ActionQueueView({ orders, onChase, onLogNote }: ActionQueueViewProps) {
  const grouped = groupOrdersBySection(orders);

  return (
    <div className="space-y-6">
      {PERMIT_SECTIONS.map((section) => {
        const sectionOrders = grouped[section.key];
        if (sectionOrders.length === 0) return null;

        return (
          <div key={section.key}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-foreground">
                {section.label}
              </h3>
              <span className="text-xs text-muted-foreground">
                ({sectionOrders.length})
              </span>
            </div>

            <div className="space-y-2">
              {sectionOrders.map((order) => (
                <PermitCard
                  key={order.id}
                  order={order}
                  section={section.key}
                  onChase={onChase}
                  onLogNote={onLogNote}
                />
              ))}
            </div>
          </div>
        );
      })}

      {orders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No active permit applications.</p>
        </div>
      )}
    </div>
  );
}
