import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';

export interface InboxOrderSummaryCardProps {
  /** Order ID (e.g. ORD-000123) */
  orderId: string;
  /** Formatted total (e.g. £3,550.00) */
  total: string;
  /** Customer name */
  customerName?: string | null;
  /** Location or extra detail */
  location?: string | null;
  /** Order type label */
  orderType: string;
  /** When set, show a small “From Quote” badge beside the type */
  fromQuote?: boolean;
  /** Status & Progress section items */
  statusItems?: { label: string; value: string }[];
  /** Order Information section items */
  infoItems?: { label: string; value: string }[];
  /** Financial section items */
  financialItems?: { label: string; value: string }[];
  className?: string;
  children?: React.ReactNode;
}

const SECTION_LABEL_CLASS = 'text-xs font-semibold uppercase tracking-wide text-slate-800';

/** Order summary card for right panel. Sections: Status & Progress + Order Information. No shadcn. */
export const InboxOrderSummaryCard: React.FC<InboxOrderSummaryCardProps> = ({
  orderId,
  total,
  customerName,
  location,
  orderType,
  fromQuote = false,
  statusItems = [],
  infoItems = [],
  financialItems = [],
  className,
  children,
}) => (
  <div
    className={cn(
      'rounded-xl border border-slate-200 bg-white/90 p-3.5 space-y-3 shadow-sm',
      className
    )}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="font-semibold text-sm text-slate-900 font-mono">{orderId}</span>
      <span className="text-sm text-slate-600">{total}</span>
    </div>
    {customerName && (
      <p className="text-xs text-slate-600 truncate">{customerName}</p>
    )}
    {location && (
      <p className="text-xs text-slate-600 truncate">{location}</p>
    )}
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] font-medium text-slate-500 px-2 py-0.5 rounded-md bg-slate-100">
        {orderType}
      </span>
      {fromQuote && (
        <Badge variant="secondary" className="text-[10px] font-normal h-5 px-1.5">
          From Quote
        </Badge>
      )}
    </div>

    {statusItems.length > 0 && (
      <div className="space-y-1.5">
        <p className={SECTION_LABEL_CLASS}>Status &amp; Progress</p>
        <div className="space-y-1">
          {statusItems.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">{label}</span>
              <span className="text-[11px] font-medium text-slate-700 truncate">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}

    {infoItems.length > 0 && (
      <div className="space-y-1.5">
        <p className={SECTION_LABEL_CLASS}>Order Information</p>
        <div className="space-y-1">
          {infoItems.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">{label}</span>
              <span className="text-[11px] font-medium text-slate-700 truncate">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
    {financialItems.length > 0 && (
      <div className="space-y-1.5">
        <p className={SECTION_LABEL_CLASS}>Financial</p>
        <div className="space-y-1">
          {financialItems.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">{label}</span>
              <span className="text-[11px] font-medium text-slate-700 truncate">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
    {children}
  </div>
);
