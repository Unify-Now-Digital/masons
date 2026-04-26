import { isKerb, type JobLike } from './jobTypeClassifier';

export const SLOTS_PER_DAY = 3;
export const MAX_KERBS_PER_DAY = 2;

export interface DayComposition {
  kerb: number;
  other: number;
  total: number;
  remaining: number;
}

export function compose(orders: JobLike[]): DayComposition {
  const kerb = orders.filter(isKerb).length;
  const other = orders.length - kerb;
  const total = orders.length;
  return {
    kerb,
    other,
    total,
    remaining: Math.max(0, SLOTS_PER_DAY - total),
  };
}

export interface CapacityCheck {
  ok: boolean;
  reason?: 'day_full' | 'kerb_limit';
}

export function canAdd(existing: JobLike[], candidate: JobLike): CapacityCheck {
  const c = compose(existing);
  if (c.total >= SLOTS_PER_DAY) return { ok: false, reason: 'day_full' };
  if (isKerb(candidate) && c.kerb >= MAX_KERBS_PER_DAY) {
    return { ok: false, reason: 'kerb_limit' };
  }
  return { ok: true };
}
