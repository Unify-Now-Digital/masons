/**
 * Orders table groups (IA-10.7). Priority is the default.
 * Supplier is omitted: no stone-supplier field is stored.
 * Council is the cemetery name (no separate council field).
 * Stone is independent of proof and permit.
 */
import type { UIOrder } from './orderTransform';
import { orderNextAction } from './orderNextAction';
import { depositAgeDays, STONE_OVERDUE_AFTER_DAYS } from './stageTone';
import { needsUs } from '@/shared/lib/nextAction';

export type OrdersGroupBy = 'priority' | 'stage' | 'cemetery' | 'none';

export const PRIORITY_GROUPS = ['Overdue', 'Due this week', 'On track', 'Waiting on others'] as const;
export type PriorityGroup = (typeof PRIORITY_GROUPS)[number];

export const STAGE_GROUPS = ['Stone', 'Permit', 'Proof', 'Other'] as const;
export type StageGroup = (typeof STAGE_GROUPS)[number];

const GROUP_KEY = (orgId: string) => `mason-orders-groupby:${orgId}`;
const MODES: OrdersGroupBy[] = ['priority', 'stage', 'cemetery', 'none'];

export function readOrdersGroupBy(orgId: string | null | undefined): OrdersGroupBy {
  if (!orgId || typeof localStorage === 'undefined') return 'priority';
  try {
    const v = localStorage.getItem(GROUP_KEY(orgId));
    return MODES.includes(v as OrdersGroupBy) ? (v as OrdersGroupBy) : 'priority';
  } catch {
    return 'priority';
  }
}

export function writeOrdersGroupBy(orgId: string, mode: OrdersGroupBy): void {
  try {
    localStorage.setItem(GROUP_KEY(orgId), mode);
  } catch {
    /* private mode */
  }
}

function createdAgeDays(order: UIOrder, now: Date): number | null {
  if (!order.createdAt) return null;
  const t = Date.parse(order.createdAt);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** Age of the current next step, in days. Null when there is no clock to read. */
export function nextStepAgeDays(order: UIOrder, now: Date): number | null {
  const fromDeposit = depositAgeDays(order.depositDate, order.jobPaidAt, now);
  if (fromDeposit != null) return fromDeposit;
  return createdAgeDays(order, now);
}

export function formatStepAge(days: number | null): string | null {
  if (days == null || days < 0) return null;
  if (days === 0) return 'today';
  if (days >= 14) return `${Math.floor(days / 7)}w`;
  return `${days}d`;
}

/**
 * Until a safe date is stored: red next step → Overdue; amber and 7d+ → Due this week;
 * other amber → On track; waiting → Waiting on others.
 */
export function orderPriorityGroup(order: UIOrder, now: Date = new Date()): PriorityGroup {
  const action = orderNextAction(order, now);
  if (action.kind === 'waiting') return 'Waiting on others';
  if (action.tone === 'red' && needsUs(action)) return 'Overdue';
  const age = nextStepAgeDays(order, now);
  if (action.tone === 'amber' && age != null && age >= 7) return 'Due this week';
  return 'On track';
}

/** The stage the row's next step belongs to. Stone is never blocked by proof or permit. */
export function orderStageGroup(order: UIOrder, now: Date = new Date()): StageGroup {
  const action = orderNextAction(order, now);
  if (action.kind === 'stone' || action.waitingOn === 'supplier') return 'Stone';
  if (action.kind === 'inscription') return 'Proof';
  if (action.waitingOn === 'cemetery' || action.waitingOn === 'grave owner') return 'Permit';
  if (action.waitingOn === 'customer') {
    if (order.proofStatus === 'Sent') return 'Proof';
    if (order.permitStatus === 'form_sent' || order.permitStatus === 'customer_completed') return 'Permit';
  }
  return 'Other';
}

export function cemeteryGroupKey(order: UIOrder): string {
  const name = order.cemeteryName?.trim() || order.location?.trim();
  return name || 'No cemetery';
}

const STAGE_WEIGHT: Record<StageGroup, number> = { Stone: 0, Permit: 1, Proof: 2, Other: 3 };

function ts(v: string | null | undefined): number {
  const t = v ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Oldest age, then Stone > Permit > Proof, then oldest confirmation. */
export function compareOrderPriority(a: UIOrder, b: UIOrder, now: Date = new Date()): number {
  const aa = nextStepAgeDays(a, now) ?? -1;
  const bb = nextStepAgeDays(b, now) ?? -1;
  if (aa !== bb) return bb - aa;
  const dw = STAGE_WEIGHT[orderStageGroup(a, now)] - STAGE_WEIGHT[orderStageGroup(b, now)];
  if (dw !== 0) return dw;
  return ts(a.createdAt) - ts(b.createdAt);
}

export interface OrderGroup {
  key: string;
  orders: UIOrder[];
}

export function groupOrders(orders: UIOrder[], mode: OrdersGroupBy, now: Date = new Date()): OrderGroup[] {
  if (mode === 'none') return orders.length ? [{ key: 'All orders', orders }] : [];
  const buckets = new Map<string, UIOrder[]>();
  for (const order of orders) {
    const key = mode === 'priority'
      ? orderPriorityGroup(order, now)
      : mode === 'stage'
        ? orderStageGroup(order, now)
        : cemeteryGroupKey(order);
    const list = buckets.get(key);
    if (list) list.push(order);
    else buckets.set(key, [order]);
  }
  const keys = mode === 'priority'
    ? PRIORITY_GROUPS.filter((k) => buckets.has(k))
    : mode === 'stage'
      ? STAGE_GROUPS.filter((k) => buckets.has(k))
      : [...buckets.keys()].sort((a, b) => a.localeCompare(b, 'en-GB'));
  return keys.map((key) => ({ key, orders: buckets.get(key) ?? [] }));
}

export function groupBulkLabel(mode: OrdersGroupBy, groupKey: string, orders: UIOrder[], now: Date = new Date()): string | null {
  const actions = orders.map((o) => orderNextAction(o, now));
  const stones = actions.filter((a) => a.kind === 'stone').length;
  const permits = actions.filter((a) => /permit/i.test(a.label) || /permit/i.test(a.reason)).length;
  if (mode === 'priority' && groupKey === 'Overdue' && stones > 0) {
    return `Order ${stones} overdue stone${stones === 1 ? '' : 's'}`;
  }
  if (mode === 'cemetery' && permits > 0) {
    return `Send ${permits} permit${permits === 1 ? '' : 's'}`;
  }
  return null;
}

export { STONE_OVERDUE_AFTER_DAYS };
