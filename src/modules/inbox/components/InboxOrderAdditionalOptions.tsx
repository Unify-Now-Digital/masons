import React from 'react';
import { useAdditionalOptionsByOrder } from '@/modules/orders/hooks/useOrders';
import { formatGbpDecimal } from '@/shared/lib/formatters';

interface InboxOrderAdditionalOptionsProps {
  orderId: string;
}

/**
 * Itemized additional-option lines for one order in the Finance card.
 * Owns its own useAdditionalOptionsByOrder query (key ['orders','additionalOptions',orderId],
 * TanStack-deduped against any other consumer — FR-006 option (a)).
 * Renders nothing while loading or when the order has no options. Note: with the
 * Orders-card consumer removed (C2), a cold cache means the lines can pop in on
 * first render — accepted, watched at browser verify (T205).
 */
export const InboxOrderAdditionalOptions: React.FC<InboxOrderAdditionalOptionsProps> = ({ orderId }) => {
  const { data: additionalOptions = [] } = useAdditionalOptionsByOrder(orderId);

  if (additionalOptions.length === 0) return null;

  return (
    <div className="space-y-1 pl-2">
      {additionalOptions.map((opt) => {
        const cost =
          typeof opt.cost === 'string' ? parseFloat(opt.cost) : (opt.cost ?? 0);
        const costLabel = Number.isFinite(cost) ? formatGbpDecimal(cost) : formatGbpDecimal(0);
        return (
          <div key={opt.id} className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-gardens-txs truncate">{opt.name}</span>
            <span className="text-[11px] font-medium text-gardens-tx shrink-0">{costLabel}</span>
          </div>
        );
      })}
    </div>
  );
};
