import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface InboxOrderListRowProps {
  orderId: string;
  description: string;
  amount: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Single order row in right-panel list. Refined, mockup-aligned. No shadcn. */
export const InboxOrderListRow: React.FC<InboxOrderListRowProps> = ({
  orderId,
  description,
  amount,
  selected = false,
  onClick,
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-2 group',
      'border border-transparent',
      selected
        ? 'bg-gardens-grn-lt/80 border-gardens-grn-lt/80 ring-1 ring-emerald-200/60'
        : 'hover:bg-gardens-page border-gardens-bdr',
      className
    )}
  >
    <div className="min-w-0 flex-1">
      <div className="font-semibold text-sm text-gardens-tx font-mono truncate">
        {orderId}
      </div>
      <div className="text-[11px] text-gardens-txs truncate mt-0.5">{description}</div>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      <span className="text-sm text-gardens-tx">{amount}</span>
    </div>
  </button>
);
