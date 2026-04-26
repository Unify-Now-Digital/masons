import React, { useMemo } from 'react';
import type { ScheduleStop } from '../../utils/scheduleTypes';
import { isKerb } from '../../utils/jobTypeClassifier';

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
      <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-xs text-zinc-500 text-center">
        All schedulable jobs are placed.
      </div>
    );
  }
  const highCount = sorted.filter((s) => s.priority === 'high').length;
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="text-xs font-medium text-zinc-700">
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
                ? 'bg-amber-50 ring-1 ring-amber-300'
                : 'hover:bg-zinc-50'
            }`}
          >
            <span
              className={`inline-block w-2.5 h-2.5 flex-shrink-0 ${
                isKerb(s) ? 'rounded-sm bg-emerald-700' : 'rounded-full bg-amber-600'
              }`}
            />
            {s.priority === 'high' && (
              <span
                title="High priority"
                className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0"
              />
            )}
            <span className="truncate">
              <span className="font-medium text-zinc-900">{s.customerName}</span>
              {' · '}
              <span className="text-zinc-600">{s.location}</span>
              {' · '}
              <span className="text-zinc-500">{s.orderType}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
