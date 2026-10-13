import { nextActionForOrder, needsUs, type NextAction } from '@/shared/lib/nextAction';
import type { UIOrder } from './orderTransform';

/** Next action for an Orders row, from fields already on UIOrder. */
export function orderNextAction(order: UIOrder, now: Date = new Date()): NextAction {
  return nextActionForOrder(
    {
      jobStage: order.jobStage,
      jobExitReason: order.jobExitReason,
      jobPaidAt: order.jobPaidAt,
      depositDate: order.depositDate || null,
      secondPaymentDate: order.secondPaymentDate,
      stoneStatus: order.stoneStatus,
      permitStatus: order.permitStatus,
      proofStatus: order.proofStatus,
      installationDate: order.installationDate,
    },
    now,
  );
}

export type OrderActionGroup = 'needs_us' | 'waiting' | 'nothing_due';

export const ORDER_GROUP_LABEL: Record<OrderActionGroup, string> = {
  needs_us: 'Needs us',
  waiting: 'Waiting on others',
  nothing_due: 'Nothing due',
};

/** Splits rows into groups, keeping the incoming (sorted) order inside each; empty groups dropped. */
export function groupOrdersByNextAction<T extends UIOrder>(
  orders: T[],
  now: Date = new Date(),
): { key: OrderActionGroup; orders: T[] }[] {
  const groups: Record<OrderActionGroup, T[]> = { needs_us: [], waiting: [], nothing_due: [] };
  for (const o of orders) {
    const a = orderNextAction(o, now);
    groups[needsUs(a) ? 'needs_us' : a.kind === 'waiting' ? 'waiting' : 'nothing_due'].push(o);
  }
  return (['needs_us', 'waiting', 'nothing_due'] as const)
    .filter((k) => groups[k].length > 0)
    .map((k) => ({ key: k, orders: groups[k] }));
}

/** Arin, 2026-10-14: "Nothing due" stays as a third group but starts collapsed. */
export function isGroupCollapsedByDefault(key: OrderActionGroup): boolean {
  return key === 'nothing_due';
}

/**
 * Where the drawer's next-step primary takes you. Only existing screens/sections:
 * no new behaviour. `scroll:proof` scrolls to the drawer's own Proof panel.
 */
export function nextStepTarget(kind: string): { to: string; label: string } | null {
  switch (kind) {
    case 'permit':
      return { to: '/dashboard/permit-tracker', label: 'Send permit to cemetery' };
    case 'proof':
      return { to: 'scroll:proof', label: 'Draft a 2D proof' };
    case 'deposit':
      return { to: '/dashboard/finance', label: 'Request deposit' };
    case 'balance':
      return { to: '/dashboard/finance', label: 'Create balance payment' };
    case 'order':
      return { to: '/dashboard/finance', label: 'Create order/invoice' };
    default:
      return null;
  }
}
