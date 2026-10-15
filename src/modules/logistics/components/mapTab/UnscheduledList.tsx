import React, { useMemo } from 'react';
import type { ScheduleStop } from '../../utils/scheduleTypes';
import { isKerb } from '../../utils/jobTypeClassifier';
import { TestPill } from '@/shared/components/TestPill';

interface UnscheduledListProps {
  stops: ScheduleStop[];
  highlightedOrderId: string | null;
  onHover: (orderId: string | null) => void;
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
      <div className="rounded-md border border-dashed border-gardens-bdr bg-gardens-page px-3 py-4 text-xs text-gardens-txs text-center">
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
          <span className="text-[10px] font-medium text-red-600 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600" />
            {highCount} high
          </span>
        )}
      </div>
      <div className="max-h-40 overflow-y-auto space-y-0.5">
        {sorted.map((s) => (
          <div
            key={s.orderId}
            onMouseEnter={() => onHover(s.orderId)}
            onMouseLeave={() => onHover(null)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
              highlightedOrderId === s.orderId
                ? 'bg-gardens-na-amber-lt ring-1 ring-gardens-na-amber'
                : 'hover:bg-gardens-page'
            }`}
          >
            <span
              className={`inline-block w-2.5 h-2.5 flex-shrink-0 ${
                isKerb(s) ? 'rounded-sm bg-gardens-na-green' : 'rounded-full bg-gardens-na-amber'
              }`}
            />
            {s.priority === 'high' && (
              <span
                title="High priority"
                className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0"
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
          </div>
        ))}
      </div>
    </div>
  );
};
