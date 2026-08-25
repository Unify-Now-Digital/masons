import React from 'react';
import { PoundSterling } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { Order } from '@/modules/orders/types/orders.types';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { formatOrderTypeLabel } from '@/modules/orders/utils/orderTypeDisplay';
import {
  getOrderAdditionalOptionsTotal,
  getOrderBaseValue,
  getOrderPermitCost,
  getOrderTotal,
} from '@/modules/orders/utils/orderCalculations';
import { formatGbpDecimal } from '@/shared/lib/formatters';

export interface InboxFinancesTabProps {
  /** Displayed set: jobOrders + unassignedOrders, the panel's existing arrays. */
  orders: Order[];
  isLoading: boolean;
}

/** Finances tab body for the inbox right panel. Presentational only — no data hooks. */
export const InboxFinancesTab: React.FC<InboxFinancesTabProps> = ({ orders, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-24 w-full rounded-xl bg-gardens-bdr/80" />
        <Skeleton className="h-24 w-full rounded-xl bg-gardens-bdr/80" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <PoundSterling className="h-5 w-5 text-gardens-txs" />
        <p className="text-sm text-gardens-txs">No orders to summarise yet</p>
      </div>
    );
  }

  const grandTotal = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);

  return (
    <>
      {orders.map((order) => {
        const baseValue = getOrderBaseValue(order);
        const permitCost = getOrderPermitCost(order);
        const optionsTotal = getOrderAdditionalOptionsTotal(order);
        const orderTotal = getOrderTotal(order);
        // Zero rows are omitted, matching OrderContextSummary's financialItems
        // exactly (a zero renders as absence there, not £0.00 or a dash).
        const rows: { label: string; value: string }[] = [];
        if (baseValue > 0) rows.push({ label: 'Base value', value: formatGbpDecimal(baseValue) });
        if (permitCost > 0) rows.push({ label: 'Permit cost', value: formatGbpDecimal(permitCost) });
        if (optionsTotal > 0)
          rows.push({ label: 'Additional options total', value: formatGbpDecimal(optionsTotal) });
        if (orderTotal > 0)
          rows.push({ label: 'Order total', value: formatGbpDecimal(orderTotal) });
        return (
          <div
            key={order.id}
            className="rounded-xl border border-gardens-bdr bg-white/90 p-3.5 space-y-1.5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-gardens-tx font-mono truncate">
                {getOrderDisplayId(order)}
              </span>
              <span className="shrink-0 text-[11px] font-medium text-gardens-txs px-2 py-0.5 rounded-md bg-gardens-page">
                {formatOrderTypeLabel(order.order_type)}
              </span>
            </div>
            {rows.length > 0 && (
              <div className="space-y-1 pt-1">
                {rows.map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gardens-txs">{label}</span>
                    <span className="text-[11px] font-medium text-gardens-tx">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="rounded-xl border border-gardens-bdr bg-gardens-page/80 px-3.5 py-2.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gardens-tx">
          Grand total
        </span>
        <span className="text-sm font-semibold text-gardens-tx">
          {formatGbpDecimal(grandTotal)}
        </span>
      </div>
    </>
  );
};
