import React, { useMemo } from 'react';
import type { ScheduleStop } from '../../utils/scheduleTypes';
import { isKerb } from '../../utils/jobTypeClassifier';
import { TestPill } from '@/shared/components/TestPill';

interface UnscheduledListProps {
  stops: ScheduleStop[];
  highlightedOrderId: string | null;
  onHover: (orderId: string | null) => void;
  onFocus: (orderId: string) => void;
}

const PRIORITY_RANK: Record<ScheduleStop['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const UnscheduledList: React.FC<UnscheduledListProps> = ({
  stops,
  highlightedOrderId,
  onHover,
  onFocus,
}) => {
  const sorted = useMemo(
    () =>
      [...stops].sort((a, b) => {
        const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (p !== 0) return p;
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [stops]
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gardens-bdr bg-gardens-page px-3 py-4 text-center text-xs text-gardens-txs">
        All schedulable jobs are placed.
      </div>
    );
  }
  const highCount = sorted.filter((s) => s.priority === 'high').length;
  return (
    <div className="rounded-md border border-gardens-bdr bg-gardens-surf p-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="text-xs font-medium text-gardens-tx">
          Unscheduled ({sorted.length})
        </div>
        {highCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600" />
            {highCount} high
          </span>
        )}
      </div>
      <div className="max-h-40 space-y-0.5 overflow-y-auto">
        {sorted.map((s) => (
          <button
            key={s.orderId}
            type="button"
            onMouseEnter={() => onHover(s.orderId)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onFocus(s.orderId)}
            title="Show on map"
            className={`flex min-h-11 w-full items-center gap-1.5 rounded px-2 text-left text-xs md:min-h-8 ${
              highlightedOrderId === s.orderId
                ? 'bg-gardens-na-amber-lt ring-1 ring-gardens-na-amber'
                : 'hover:bg-gardens-page'
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 flex-shrink-0 ${
                isKerb(s) ? 'rounded-sm bg-gardens-na-green' : 'rounded-full bg-gardens-na-amber'
              }`}
            />
            {s.priority === 'high' && (
              <span
                title="High priority"
                className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-600"
              />
            )}
            <span className="truncate">
              <span className="font-medium text-gardens-tx">{s.customerName}</span>
              {' · '}
              <span className="text-gardens-txs">{s.location}</span>
              {' · '}
              <span className="text-gardens-txs">{s.orderType}</span>
            </span>
            <TestPill isTest={s.isTest} className="ml-1" />
          </button>
        ))}
      </div>
    </div>
  );
};
