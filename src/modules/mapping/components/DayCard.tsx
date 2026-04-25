import React from 'react';
import { format, parseISO } from 'date-fns';
import { X, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import type { Order } from '@/modules/orders/types/orders.types';
import { isKerb } from '../utils/jobTypeClassifier';
import { compose, canAdd, MAX_KERBS_PER_DAY, SLOTS_PER_DAY } from '../utils/capacityRules';

interface DayCardProps {
  date: string;
  orders: Order[];
  unscheduled: Order[];
  highlightedOrderId: string | null;
  onAdd: (orderId: string) => void;
  onRemove: (orderId: string) => void;
  onHover: (orderId: string | null) => void;
}

function CompositionIcons({ kerb, other }: { kerb: number; other: number }) {
  const slots: React.ReactNode[] = [];
  for (let i = 0; i < kerb; i++) {
    slots.push(
      <span
        key={`k${i}`}
        title="Kerb set"
        className="inline-block w-3 h-3 rounded-sm bg-emerald-700"
      />
    );
  }
  for (let i = 0; i < other; i++) {
    slots.push(
      <span
        key={`o${i}`}
        title="Other job"
        className="inline-block w-3 h-3 rounded-full bg-amber-600"
      />
    );
  }
  for (let i = kerb + other; i < SLOTS_PER_DAY; i++) {
    slots.push(
      <span
        key={`e${i}`}
        title="Empty slot"
        className="inline-block w-3 h-3 rounded-sm border border-dashed border-zinc-300"
      />
    );
  }
  return <div className="flex items-center gap-1">{slots}</div>;
}

export const DayCard: React.FC<DayCardProps> = ({
  date,
  orders,
  unscheduled,
  highlightedOrderId,
  onAdd,
  onRemove,
  onHover,
}) => {
  const c = compose(orders);
  const dateLabel = format(parseISO(date), 'EEE d MMM');
  const dayFull = c.total >= SLOTS_PER_DAY;
  const kerbFull = c.kerb >= MAX_KERBS_PER_DAY;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{dateLabel}</div>
          <div className="text-xs text-zinc-500">
            {c.kerb} kerb · {c.other} other · {c.total}/{SLOTS_PER_DAY}
          </div>
        </div>
        <CompositionIcons kerb={c.kerb} other={c.other} />
      </div>

      <div className="space-y-1">
        {orders.length === 0 && (
          <div className="text-xs text-zinc-400 italic px-1">No jobs</div>
        )}
        {orders.map((o) => (
          <div
            key={o.id}
            onMouseEnter={() => onHover(o.id)}
            onMouseLeave={() => onHover(null)}
            className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-xs ${
              highlightedOrderId === o.id ? 'bg-amber-50 ring-1 ring-amber-300' : 'hover:bg-zinc-50'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-block w-2.5 h-2.5 flex-shrink-0 ${
                  isKerb(o) ? 'rounded-sm bg-emerald-700' : 'rounded-full bg-amber-600'
                }`}
              />
              <span className="truncate">
                <span className="font-medium text-zinc-900">{o.customer_name}</span>
                {' · '}
                <span className="text-zinc-600">{o.location}</span>
              </span>
            </div>
            <button
              type="button"
              aria-label="Remove from day"
              className="text-zinc-400 hover:text-zinc-700 flex-shrink-0"
              onClick={() => onRemove(o.id)}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={dayFull}
            >
              <Plus className="w-3 h-3 mr-1" /> Add job
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="text-xs font-medium text-zinc-700 mb-1">
              Add to {dateLabel}
            </div>
            {unscheduled.length === 0 && (
              <div className="text-xs text-zinc-500 px-1 py-2">
                No unscheduled jobs.
              </div>
            )}
            <div className="max-h-64 overflow-y-auto">
              {unscheduled.map((o) => {
                const check = canAdd(orders, o);
                const blockedKerb = !check.ok && check.reason === 'kerb_limit';
                return (
                  <button
                    type="button"
                    key={o.id}
                    disabled={!check.ok}
                    onClick={() => onAdd(o.id)}
                    title={blockedKerb ? `Already ${MAX_KERBS_PER_DAY} kerb sets` : undefined}
                    className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span
                      className={`inline-block w-2.5 h-2.5 flex-shrink-0 ${
                        isKerb(o) ? 'rounded-sm bg-emerald-700' : 'rounded-full bg-amber-600'
                      }`}
                    />
                    <span className="truncate">
                      <span className="font-medium">{o.customer_name}</span>
                      {' · '}
                      <span className="text-zinc-600">{o.location}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {kerbFull && (
              <div className="text-[11px] text-zinc-500 mt-1 px-1">
                Kerb limit reached for this day.
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
