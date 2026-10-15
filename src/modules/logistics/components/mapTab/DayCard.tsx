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
  onFocus: (orderId: string) => void;
}

const iconBtn =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-gardens-txm-aa hover:bg-gardens-page hover:text-gardens-tx md:min-h-8 md:min-w-8';

function CompositionIcons({ kerb, other }: { kerb: number; other: number }) {
  const slots: React.ReactNode[] = [];
  for (let i = 0; i < kerb; i++) {
    slots.push(
      <span
        key={`k${i}`}
        title="Kerb set"
        className="inline-block h-3 w-3 rounded-sm bg-gardens-na-green"
      />
    );
  }
  for (let i = 0; i < other; i++) {
    slots.push(
      <span
        key={`o${i}`}
        title="Other job"
        className="inline-block h-3 w-3 rounded-full bg-gardens-na-amber"
      />
    );
  }
  for (let i = kerb + other; i < SLOTS_PER_DAY; i++) {
    slots.push(
      <span
        key={`e${i}`}
        title="Empty slot"
        className="inline-block h-3 w-3 rounded-sm border border-dashed border-gardens-bdr"
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
      className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-600"
    />
  );
}

function ShapeGlyph({ kerb }: { kerb: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 flex-shrink-0 ${
        kerb ? 'rounded-sm bg-gardens-na-green' : 'rounded-full bg-gardens-na-amber'
      }`}
    />
  );
}

function AddJobButton({
  dateLabel,
  stops,
  unscheduled,
  onAdd,
  dayFull,
  kerbFull,
  compact,
}: {
  dateLabel: string;
  stops: ScheduleStop[];
  unscheduled: ScheduleStop[];
  onAdd: (orderId: string) => void;
  dayFull: boolean;
  kerbFull: boolean;
  compact: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label={`Add job on ${dateLabel}`}
            title="Add job"
            disabled={dayFull}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-gardens-bdr text-gardens-tx hover:bg-gardens-page disabled:cursor-not-allowed disabled:opacity-40 md:min-h-8 md:min-w-8"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : (
          <Button size="sm" variant="outline" className="h-11 text-xs md:h-8" disabled={dayFull}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add job
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="mb-1 text-xs font-medium text-gardens-tx">
          Add to {dateLabel}
        </div>
        {unscheduled.length === 0 && (
          <div className="px-1 py-2 text-xs text-gardens-txs">
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
                className="flex min-h-11 w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs hover:bg-gardens-page disabled:cursor-not-allowed disabled:opacity-40 md:min-h-8"
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
          <div className="mt-1 px-1 text-xs text-gardens-txs">
            Kerb limit reached for this day.
          </div>
        )}
      </PopoverContent>
    </Popover>
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
  onFocus,
}) => {
  const c = compose(stops);
  const dateLabel = format(parseISO(date), 'EEE d MMM');
  const dayFull = c.total >= SLOTS_PER_DAY;
  const kerbFull = c.kerb >= MAX_KERBS_PER_DAY;
  const moveTargets = horizonDates.filter((d) => d !== date);

  if (stops.length === 0) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-md border border-gardens-bdr bg-gardens-surf px-2 py-1 md:min-h-8">
        <span className="shrink-0 text-xs font-semibold text-gardens-tx">{dateLabel}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-gardens-txs">
          No jobs · 0 kerb · 0 other · 0/{SLOTS_PER_DAY}
        </span>
        <AddJobButton
          dateLabel={dateLabel}
          stops={stops}
          unscheduled={unscheduled}
          onAdd={onAdd}
          dayFull={dayFull}
          kerbFull={kerbFull}
          compact
        />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gardens-bdr bg-gardens-surf p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gardens-tx">{dateLabel}</div>
          <div className="text-xs text-gardens-txs">
            {c.kerb} kerb · {c.other} other · {c.total}/{SLOTS_PER_DAY}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CompositionIcons kerb={c.kerb} other={c.other} />
          <button
            type="button"
            title="Push everything one workday later"
            aria-label="Push day forward"
            onClick={() => onPushDay(date, 1)}
            className={iconBtn}
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {stops.map((s) => {
          const pinned = pinnedOrderIds.has(s.orderId);
          return (
            <div
              key={s.orderId}
              onMouseEnter={() => onHover(s.orderId)}
              onMouseLeave={() => onHover(null)}
              className={`flex items-center justify-between gap-1 rounded text-xs ${
                highlightedOrderId === s.orderId
                  ? 'bg-gardens-na-amber-lt ring-1 ring-gardens-na-amber'
                  : 'hover:bg-gardens-page'
              }`}
            >
              <button
                type="button"
                onClick={() => onFocus(s.orderId)}
                title="Show on map"
                className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 bg-transparent px-2 text-left text-xs md:min-h-8"
              >
                <ShapeGlyph kerb={isKerb(s)} />
                <PriorityDot priority={s.priority} />
                <span className="truncate">
                  <span className="font-medium text-gardens-tx">{s.customerName}</span>
                  {' · '}
                  <span className="text-gardens-txs">{s.location}</span>
                </span>
                <TestPill isTest={s.isTest} />
              </button>
              <div className="flex shrink-0 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Move to another day"
                      className={iconBtn}
                      title="Move to another day"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1" align="end">
                    <div className="px-2 pb-1 text-xs text-gardens-txs">Move to</div>
                    <div className="max-h-56 overflow-y-auto">
                      {moveTargets.map((d) => (
                        <button
                          type="button"
                          key={d}
                          onClick={() => onMove(s.orderId, d)}
                          className="min-h-11 w-full rounded px-2 py-1 text-left text-xs hover:bg-gardens-page md:min-h-8"
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
                  className={`${iconBtn} ${pinned ? 'text-gardens-tx' : ''}`}
                >
                  {pinned ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Remove from day"
                  title="Remove from day"
                  className={iconBtn}
                  onClick={() => onRemove(s.orderId)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2">
        <AddJobButton
          dateLabel={dateLabel}
          stops={stops}
          unscheduled={unscheduled}
          onAdd={onAdd}
          dayFull={dayFull}
          kerbFull={kerbFull}
          compact={false}
        />
      </div>
    </div>
  );
};
