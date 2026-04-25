import { addDays, format, getDay } from 'date-fns';
import type { Order } from '@/modules/orders/types/orders.types';
import { isKerb } from './jobTypeClassifier';
import { clusterBySite, type GeoOrder } from './groupByLocation';
import { canAdd, MAX_KERBS_PER_DAY, SLOTS_PER_DAY } from './capacityRules';

export interface ProposedDay {
  date: string;
  orderIds: string[];
}

export interface AutoScheduleOptions {
  startDate?: Date;
  /** 0 = Sunday, 6 = Saturday. Default skips Sat (6) and Sun (0). */
  skipWeekdays?: number[];
}

const DEFAULT_SKIP = [0, 6];

function isWorkday(date: Date, skip: number[]): boolean {
  return !skip.includes(getDay(date));
}

function nextWorkday(from: Date, skip: number[]): Date {
  let d = from;
  while (!isWorkday(d, skip)) d = addDays(d, 1);
  return d;
}

/**
 * Pure scheduler. Groups orders by site (2-mile radius), then walks workdays
 * filling each day to capacity (3 jobs total, max 2 kerbs). Mixed days are
 * allowed, e.g. 1 kerb + 2 others. Same-site orders are kept together where
 * possible to minimise travel.
 */
export function autoSchedule(
  orders: Order[],
  options: AutoScheduleOptions = {}
): ProposedDay[] {
  const startDate = options.startDate ?? new Date();
  const skip = options.skipWeekdays ?? DEFAULT_SKIP;

  const geo = orders.filter(
    (o): o is GeoOrder =>
      typeof o.latitude === 'number' && typeof o.longitude === 'number'
  );

  const stable = [...geo].sort((a, b) => {
    const locCmp = (a.location ?? '').localeCompare(b.location ?? '');
    if (locCmp !== 0) return locCmp;
    return a.latitude - b.latitude;
  });

  const clusters = clusterBySite(stable);
  const queue: GeoOrder[] = clusters.flat();

  const days: ProposedDay[] = [];
  let cursor = nextWorkday(startDate, skip);
  let dayKerbs = 0;
  let dayCount = 0;
  let current: ProposedDay = { date: format(cursor, 'yyyy-MM-dd'), orderIds: [] };

  const closeDay = () => {
    if (current.orderIds.length > 0) days.push(current);
    cursor = nextWorkday(addDays(cursor, 1), skip);
    current = { date: format(cursor, 'yyyy-MM-dd'), orderIds: [] };
    dayKerbs = 0;
    dayCount = 0;
  };

  for (let i = 0; i < queue.length; i++) {
    const order = queue[i];
    const kerb = isKerb(order);
    const fits = dayCount < SLOTS_PER_DAY && (!kerb || dayKerbs < MAX_KERBS_PER_DAY);

    if (!fits) {
      // If the day still has slots but only kerb cap was hit, try to find a
      // non-kerb order later in the queue to fill the remaining slot before
      // closing the day. Keeps packing tight.
      if (dayCount < SLOTS_PER_DAY && kerb && dayKerbs >= MAX_KERBS_PER_DAY) {
        const swapIdx = queue.findIndex((o, j) => j > i && !isKerb(o));
        if (swapIdx > -1) {
          const [swap] = queue.splice(swapIdx, 1);
          queue.splice(i, 0, swap);
          i--; // re-process this index with the swapped order
          continue;
        }
      }
      closeDay();
    }

    current.orderIds.push(order.id);
    dayCount++;
    if (kerb) dayKerbs++;
  }

  if (current.orderIds.length > 0) days.push(current);
  return days;
}
