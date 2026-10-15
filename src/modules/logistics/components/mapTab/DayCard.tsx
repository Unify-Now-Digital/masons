import React from 'react';
import { format, parseISO } from 'date-fns';
import { X, Plus, Lock, Unlock, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import type { ScheduleStop } from '../../utils/scheduleTypes';
import { isKerb } from '../../utils/jobTypeClassifier';
import {
  compose,
  canAdd,
  MAX_KERBS_PER_DAY,
  SLOTS_PER_DAY,
} from '../../utils/capacityRules';
import { TestPill } from '@/shared/components/TestPill';

interface DayCardProps {
  date: string;
  stops: ScheduleStop[];
  unscheduled: ScheduleStop[];
  pinnedOrderIds: Set<string>;
  highlightedOrderId: string | null;
  /** Other workdays in the horizon, used by the per-row "Move to…" popover. */
  horizonDates: string[];
  onAdd: (orderId: string) => void;
  onRemove: (orderId: string) => void;
  onMove: (orderId: string, toDate: string) => void;
  onTogglePin: (orderId: string) => void;
  onPushDay: (date: string, days: number) => void;
  onHover: (orderId: string | null) => void;
}

function CompositionIcons({ kerb, other }: { kerb: number; other: number }) {
  const slots: React.ReactNode[] = [];
  for (let i = 0; i < kerb; i++) {
    slots.push(
      <span
        key={`k${i}`}
        title="Kerb set"
        className="inline-block w-3 h-3 rounded-sm bg-gardens-na-green"
      />
    );
  }
  for (let i = 0; i < other; i++) {
    slots.push(
      <span
        key={`o${i}`}
        title="Other job"
        className="inline-block w-3 h-3 rounded-full bg-gardens-na-amber"
      />
    );
  }
  for (let i = kerb + other; i < SLOTS_PER_DAY; i++) {
    slots.push(
      <span
        key={`e${i}`}
        title="Empty slot"
        className="inline-block w-3 h-3 rounded-sm border border-dashed border-gardens-bdr"
      />
    );
  }
  return <div className="flex items-center gap-1">{slots}</div>;
}

function PriorityDot({ priority }: { priority: ScheduleStop['priority'] }) {
  if (priority !== 'high') return null;
  return (
    <span
      title="High priority"
      className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0"
    />
  );
}

function ShapeGlyph({ kerb }: { kerb: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 flex-shrink-0 ${
        kerb ? 'rounded-sm bg-gardens-na-green' : 'rounded-full bg-gardens-na-amber'
      }`}
    />
  );
}

export const DayCard: React.FC<DayCardProps> = ({
  date,
  stops,
  unscheduled,
  pinnedOrderIds,
  highlightedOrderId,
  horizonDates,
  onAdd,
  onRemove,
  onMove,
  onTogglePin,
  onPushDay,
  onHover,
}) => {
  const c = compose(stops);
  const dateLabel = format(parseISO(date), 'EEE d MMM');
  const dayFull = c.total >= SLOTS_PER_DAY;
  const kerbFull = c.kerb >= MAX_KERBS_PER_DAY;
  const moveTargets = horizonDates.filter((d) => d !== date);

  return (
    <div className="rounded-md border border-gardens-bdr bg-gardens-surf p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-gardens-tx">{dateLabel}</div>
          <div className="text-xs text-gardens-txs">
            {c.kerb} kerb · {c.other} other · {c.total}/{SLOTS_PER_DAY}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CompositionIcons kerb={c.kerb} other={c.other} />
          {stops.length > 0 && (
            <button
              type="button"
              title="Push everything one workday later"
              aria-label="Push day forward"
              onClick={() => onPushDay(date, 1)}
              className="text-gardens-txm-aa hover:text-gardens-tx p-0.5"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {stops.length === 0 && (
          <div className="text-xs text-gardens-txm-aa italic px-1">No jobs</div>
        )}
        {stops.map((s) => {
          const pinned = pinnedOrderIds.has(s.orderId);
          return (
            <div
              key={s.orderId}
              onMouseEnter={() => onHover(s.orderId)}
              onMouseLeave={() => onHover(null)}
              className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-xs ${
                highlightedOrderId === s.orderId
                  ? 'bg-gardens-na-amber-lt ring-1 ring-gardens-na-amber'
                  : 'hover:bg-gardens-page'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <ShapeGlyph kerb={isKerb(s)} />
                <PriorityDot priority={s.priority} />
                <span className="truncate">
                  <span className="font-medium text-gardens-tx">{s.customerName}</span>
                  {' · '}
                  <span className="text-gardens-txs">{s.location}</span>
                </span>
                <TestPill isTest={s.isTest} />
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Move to another day"
                      className="text-gardens-txm-aa hover:text-gardens-tx p-0.5"
                      title="Move to another day"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1" align="end">
                    <div className="text-[11px] text-gardens-txs px-2 pb-1">Move to</div>
                    <div className="max-h-56 overflow-y-auto">
                      {moveTargets.map((d) => (
                        <button
                          type="button"
                          key={d}
                          onClick={() => onMove(s.orderId, d)}
                          className="w-full text-left px-2 py-1 text-xs rounded hover:bg-gardens-page"
                        >
                          {format(parseISO(d), 'EEE d MMM')}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  aria-label={pinned ? 'Unpin' : 'Pin to this day'}
                  title={pinned ? 'Unpin from this day' : 'Pin to this day'}
                  onClick={() => onTogglePin(s.orderId)}
                  className={`p-0.5 ${
                    pinned ? 'text-gardens-tx' : 'text-gardens-txm-aa hover:text-gardens-tx'
                  }`}
                >
                  {pinned ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Remove from day"
                  title="Remove from day"
                  className="text-gardens-txm-aa hover:text-gardens-tx p-0.5"
                  onClick={() => onRemove(s.orderId)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={dayFull}>
              <Plus className="w-3 h-3 mr-1" /> Add job
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="text-xs font-medium text-gardens-tx mb-1">
              Add to {dateLabel}
            </div>
            {unscheduled.length === 0 && (
              <div className="text-xs text-gardens-txs px-1 py-2">
                No unscheduled jobs.
              </div>
            )}
            <div className="max-h-64 overflow-y-auto">
              {unscheduled.map((s) => {
                const check = canAdd(stops, s);
                const blockedKerb = !check.ok && check.reason === 'kerb_limit';
                return (
                  <button
                    type="button"
                    key={s.orderId}
                    disabled={!check.ok}
                    onClick={() => onAdd(s.orderId)}
                    title={
                      blockedKerb
                        ? `Already ${MAX_KERBS_PER_DAY} kerb sets`
                        : undefined
                    }
                    className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-gardens-page disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <ShapeGlyph kerb={isKerb(s)} />
                    <PriorityDot priority={s.priority} />
                    <span className="truncate">
                      <span className="font-medium">{s.customerName}</span>
                      {' · '}
                      <span className="text-gardens-txs">{s.location}</span>
                    </span>
                    <TestPill isTest={s.isTest} />
                  </button>
                );
              })}
            </div>
            {kerbFull && (
              <div className="text-[11px] text-gardens-txs mt-1 px-1">
                Kerb limit reached for this day.
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
