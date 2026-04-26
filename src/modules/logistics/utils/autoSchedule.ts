import { addDays, format, getDay } from 'date-fns';
import type { ScheduleStop } from './scheduleTypes';
import { isKerb } from './jobTypeClassifier';
import { isNearAny, SAME_SITE_RADIUS_MILES } from './groupByLocation';
import { MAX_KERBS_PER_DAY, SLOTS_PER_DAY } from './capacityRules';

export interface AutoScheduleOptions {
  startDate?: Date;
  /** Number of workdays in the planning horizon. Default 10 = 2 weeks Mon-Fri. */
  horizonWorkdays?: number;
  /** 0 = Sunday, 6 = Saturday. Default skips Sat (6) and Sun (0). */
  skipWeekdays?: number[];
  /** Pinned assignments — orderId -> ISO date. These are placed first and
   *  treated as immovable; the rest are scheduled around them. Pins on dates
   *  outside the horizon are still honoured. */
  pins?: Map<string, string>;
}

const DEFAULT_SKIP = [0, 6];
const PRIORITY_WEIGHT: Record<ScheduleStop['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function isWorkday(date: Date, skip: number[]): boolean {
  return !skip.includes(getDay(date));
}

function buildHorizon(
  startDate: Date,
  horizonWorkdays: number,
  skip: number[]
): string[] {
  const out: string[] = [];
  let cursor = startDate;
  while (out.length < horizonWorkdays) {
    if (isWorkday(cursor, skip)) {
      out.push(format(cursor, 'yyyy-MM-dd'));
    }
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * Returns a Map<orderId, dateOrNull> describing the proposed placement for
 * every stop. Pinned stops always map to their pinned date. Unpinned stops
 * land on the earliest workday that satisfies capacity rules, with a
 * preference for days that already contain a same-site neighbour. Stops
 * that don't fit anywhere within the horizon map to `null` (unscheduled).
 *
 * Pure function, no side effects.
 */
export function autoSchedule(
  stops: ScheduleStop[],
  options: AutoScheduleOptions = {}
): Map<string, string | null> {
  const startDate = options.startDate ?? new Date();
  const skip = options.skipWeekdays ?? DEFAULT_SKIP;
  const horizon = options.horizonWorkdays ?? 10;
  const pins = options.pins ?? new Map<string, string>();

  const result = new Map<string, string | null>();
  // dayBucket: date -> stops landed on it (pinned + already placed)
  const dayBucket = new Map<string, ScheduleStop[]>();

  // 1. Pre-place pinned stops (honoured even outside horizon).
  for (const stop of stops) {
    const pinDate = pins.get(stop.orderId);
    if (pinDate) {
      result.set(stop.orderId, pinDate);
      const list = dayBucket.get(pinDate) ?? [];
      list.push(stop);
      dayBucket.set(pinDate, list);
    }
  }

  // 2. Sort unpinned by priority, then queue age (oldest first), then location
  //    so same-site orders cluster together when first-fit dates tie.
  const unpinned = stops
    .filter((s) => !pins.has(s.orderId))
    .sort((a, b) => {
      const p = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (p !== 0) return p;
      const age = a.createdAt.localeCompare(b.createdAt);
      if (age !== 0) return age;
      return a.location.localeCompare(b.location);
    });

  const horizonDates = buildHorizon(startDate, horizon, skip);

  const dayHasCapacity = (date: string, candidate: ScheduleStop): boolean => {
    const existing = dayBucket.get(date) ?? [];
    if (existing.length >= SLOTS_PER_DAY) return false;
    if (isKerb(candidate)) {
      const kerbs = existing.filter(isKerb).length;
      if (kerbs >= MAX_KERBS_PER_DAY) return false;
    }
    return true;
  };

  for (const stop of unpinned) {
    // Pass 1: prefer a day that already has a same-site neighbour.
    let placed: string | null = null;
    for (const date of horizonDates) {
      if (!dayHasCapacity(date, stop)) continue;
      const neighbours = dayBucket.get(date) ?? [];
      if (neighbours.length === 0) continue;
      if (isNearAny(stop, neighbours, SAME_SITE_RADIUS_MILES)) {
        placed = date;
        break;
      }
    }
    // Pass 2: first-fit by date (any day with capacity).
    if (!placed) {
      for (const date of horizonDates) {
        if (dayHasCapacity(date, stop)) {
          placed = date;
          break;
        }
      }
    }
    if (placed) {
      result.set(stop.orderId, placed);
      const list = dayBucket.get(placed) ?? [];
      list.push(stop);
      dayBucket.set(placed, list);
    } else {
      result.set(stop.orderId, null);
    }
  }

  return result;
}

export function shiftDateByWorkdays(
  date: string,
  workdays: number,
  skip: number[] = DEFAULT_SKIP
): string {
  let cursor = new Date(date);
  let remaining = Math.abs(workdays);
  const dir = workdays >= 0 ? 1 : -1;
  while (remaining > 0) {
    cursor = addDays(cursor, dir);
    if (isWorkday(cursor, skip)) remaining--;
  }
  return format(cursor, 'yyyy-MM-dd');
}
