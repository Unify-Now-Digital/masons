import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import {
  getOrderTotalFormatted,
  getOrderBaseValue,
  getOrderPermitCost,
  getOrderAdditionalOptionsTotal,
} from '@/modules/orders/utils/orderCalculations';
import type { Order } from '@/modules/orders/types/orders.types';
import { formatOrderTypeLabel } from '@/modules/orders/utils/orderTypeDisplay';
import { InboxOrderSummaryCard } from '@/modules/inbox/components/InboxOrderSummaryCard';
import { useAdditionalOptionsByOrder } from '@/modules/orders/hooks/useOrders';
import { formatDateDMY, formatGbpDecimal } from '@/shared/lib/formatters';

interface OrderContextSummaryProps {
  order: Order;
  className?: string;
}

/** Order summary for right panel. Uses InboxOrderSummaryCard; only existing Order fields. */
export const OrderContextSummary: React.FC<OrderContextSummaryProps> = ({ order, className }) => {
  const navigate = useNavigate();
  const { data: additionalOptions = [] } = useAdditionalOptionsByOrder(order.id);

  const statusItems: { label: string; value: string }[] = [];
  if (order.stone_status) statusItems.push({ label: 'Stone status', value: order.stone_status });
  if (order.permit_status) statusItems.push({ label: 'Permit status', value: order.permit_status.replace(/_/g, ' ') });
  if (order.proof_status) statusItems.push({ label: 'Proof status', value: order.proof_status.replace(/_/g, ' ') });
  if (Number.isFinite(order.progress)) statusItems.push({ label: 'Progress', value: `${Math.round(order.progress)}%` });
  if (order.priority) statusItems.push({ label: 'Priority', value: order.priority });

  const infoItems: { label: string; value: string }[] = [];
  if (order.sku) infoItems.push({ label: 'SKU', value: order.sku });
  if (order.material) infoItems.push({ label: 'Material', value: order.material });
  if (order.color) infoItems.push({ label: 'Color', value: order.color });
  if (order.location) infoItems.push({ label: 'Location', value: order.location });
  if (order.due_date) infoItems.push({ label: 'Due date', value: formatDateDMY(order.due_date) });
  if (order.installation_date) infoItems.push({ label: 'Installation', value: formatDateDMY(order.installation_date) });
  if (order.assigned_to) infoItems.push({ label: 'Assigned to', value: order.assigned_to });
  if (order.timeline_weeks) infoItems.push({ label: 'Timeline', value: `${order.timeline_weeks} weeks` });

  // Main product + permit + additional options monetary breakdown (mirrors Order Details logic)
  const baseValue = getOrderBaseValue(order);
  const permitCost = getOrderPermitCost(order);
  const optionsTotal = getOrderAdditionalOptionsTotal(order);
  const total = baseValue + permitCost + optionsTotal;

  const financialItems: { label: string; value: string }[] = [];

  if (baseValue > 0) {
    financialItems.push({
      label: 'Base value',
      value: formatGbpDecimal(baseValue),
    });
  }

  if (permitCost > 0) {
    financialItems.push({
      label: 'Permit cost',
      value: formatGbpDecimal(permitCost),
    });
  }

  if (optionsTotal > 0) {
    financialItems.push({
      label: 'Additional options total',
      value: formatGbpDecimal(optionsTotal),
    });
  }

  if (total > 0) {
    financialItems.push({
      label: 'Total',
      value: formatGbpDecimal(total),
    });
  }

  const additionalOptionLines =
    additionalOptions?.length > 0
      ? additionalOptions.map((opt) => {
          const cost =
            typeof opt.cost === 'string'
              ? parseFloat(opt.cost)
              : (opt.cost ?? 0);
          const costLabel = Number.isFinite(cost)
            ? formatGbpDecimal(cost)
            : formatGbpDecimal(0);
          return `${opt.name} — ${costLabel}`;
        })
      : [];

  const invoiceId = order.invoice_id;

  return (
    <InboxOrderSummaryCard
      orderId={getOrderDisplayId(order)}
      total={getOrderTotalFormatted(order)}
      customerName={order.customer_name || null}
      location={order.location || null}
      orderType={formatOrderTypeLabel(order.order_type)}
      fromQuote={order.quote_id != null && String(order.quote_id).trim() !== ''}
      statusItems={statusItems}
      infoItems={infoItems}
      financialItems={financialItems}
      className={className}
    >
      {additionalOptionLines.length > 0 && (
        <div className="pt-2 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-800">
            Additional options
          </p>
          <div className="space-y-0.5">
            {additionalOptionLines.map((line) => (
              <p key={line} className="text-[11px] text-slate-700">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="pt-3 space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-800">
          Actions
        </p>
        <button
          type="button"
          disabled={!invoiceId}
          onClick={() => {
            if (!invoiceId) return;
            navigate(`/dashboard/invoicing?invoice=${encodeURIComponent(invoiceId)}`);
          }}
          className="w-full inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
        >
          {invoiceId ? 'Open invoice' : 'No invoice'}
        </button>
        <button
          type="button"
          onClick={() => {
            navigate(`/dashboard/orders?order=${encodeURIComponent(order.id)}`);
          }}
          className="w-full inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
        >
          Open full order
        </button>
      </div>
    </InboxOrderSummaryCard>
  );
};
