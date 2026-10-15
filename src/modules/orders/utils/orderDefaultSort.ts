/**
 * Default Orders sort (Arin, 2026-10-14): stone not yet ordered first, oldest first;
 * then stone ordered / in stock, oldest first. Field: orders.stone_status
 * ('NA' = not ordered, 'Ordered', 'In Stock'); age: orders.created_at.
 * Applies whenever the user has not clicked a column header (sort is never persisted).
 *
 * IA-10 renames the toolbar default to Priority (oldest age, then stage weight).
 */
import { compareOrderPriority } from './orderGroups';
import type { UIOrder } from './orderTransform';
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

export type DefaultSortMode = 'stone' | 'oldest' | 'newest' | 'value' | 'priority' | 'ref' | 'eta';

function etaSortKey(order: { supplier?: { kind?: string; deliveryDate?: string | null; deliveryEstimate?: string | null; batchCodes?: string[] } | null }): string {
  const supplier = order.supplier;
  if (!supplier || supplier.kind === 'none') return '3';
  if (supplier.deliveryDate) return `0${supplier.deliveryDate}`;
  const batch = supplier.batchCodes?.find(Boolean) ?? '';
  if (batch || supplier.deliveryEstimate) return `1${batch}|${supplier.deliveryEstimate ?? ''}`;
  return '2';
}

/** Supplier ETA is a flat list: priority groups would sort only inside each bucket. */
export function supplierEtaSortActive(defaultSort: DefaultSortMode, columnSortKey: string | null): boolean {
  return columnSortKey === 'supplier' || (columnSortKey == null && defaultSort === 'eta');
}

/** Toolbar sort. `priority` is the IA-10 default (oldest age, then stage weight). */
export function sortOrdersByMode<T extends StoneSortable & {
  total?: number;
  order_number?: number | null;
  supplier?: { kind?: string; deliveryDate?: string | null; deliveryEstimate?: string | null; batchCodes?: string[] } | null;
}>(
  orders: T[],
  mode: DefaultSortMode = 'stone',
  now: Date = new Date(),
): T[] {
  if (mode === 'priority') {
    return [...orders].sort((a, b) => compareOrderPriority(a as unknown as UIOrder, b as unknown as UIOrder, now));
  }
  if (mode === 'stone') return sortOrdersByStoneThenAge(orders);
  if (mode === 'eta') return [...orders].sort((a, b) => etaSortKey(a).localeCompare(etaSortKey(b)));
  const c = [...orders];
  if (mode === 'oldest') return c.sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
  if (mode === 'newest') return c.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
  if (mode === 'ref') {
    return c.sort((a, b) => {
      const an = a.order_number ?? Number.POSITIVE_INFINITY;
      const bn = b.order_number ?? Number.POSITIVE_INFINITY;
      return an - bn;
    });
  }
  return c.sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
}
