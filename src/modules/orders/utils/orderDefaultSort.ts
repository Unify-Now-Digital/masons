/**
 * Default Orders sort (Arin, 2026-10-14): stone not yet ordered first, oldest first;
 * then stone ordered / in stock, oldest first. Field: orders.stone_status
 * ('NA' = not ordered, 'Ordered', 'In Stock'); age: orders.created_at.
 * Applies whenever the user has not clicked a column header (sort is never persisted).
 */
export interface StoneSortable {
  stoneStatus?: string | null;
  createdAt?: string | null;
}

export function isStoneOrdered(status: string | null | undefined): boolean {
  return status === 'Ordered' || status === 'In Stock';
}

function ts(v: string | null | undefined): number {
  const t = v ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export function compareStoneThenAge(a: StoneSortable, b: StoneSortable): number {
  const ra = isStoneOrdered(a.stoneStatus) ? 1 : 0;
  const rb = isStoneOrdered(b.stoneStatus) ? 1 : 0;
  if (ra !== rb) return ra - rb;
  return ts(a.createdAt) - ts(b.createdAt);
}

export function sortOrdersByStoneThenAge<T extends StoneSortable>(orders: T[]): T[] {
  return [...orders].sort(compareStoneThenAge);
}
