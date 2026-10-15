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
      inscriptionText: order.inscriptionText,
      installationDate: order.installationDate,
      timelineWeeks: order.timelineWeeks,
    },
    now,
  );
}

export type OrderActionGroup = 'needs_us' | 'waiting' | 'nothing_due';

export const ORDER_GROUP_LABEL: Record<OrderActionGroup, string> = {
  needs_us: 'Needs us',
  waiting: 'Waiting on others',
  nothing_due: 'On track',
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

/** Arin, 2026-10-14 (rev): every group starts expanded; rows are always shown. */
export function isGroupCollapsedByDefault(_key: OrderActionGroup): boolean {
  return false;
}

/**
 * Where the drawer's next-step primary takes you. Only existing screens/sections:
 * no new behaviour.
 */
export function nextStepTarget(kind: string, invoiceId?: string | null): { to: string; label: string } | null {
  // With an invoice, deposit / balance open its Collect payment card pre-filled (2026-10-14).
  if ((kind === 'deposit' || kind === 'balance') && invoiceId) {
    const amount = kind === 'deposit' ? 'deposit' : 'full';
    return {
      to: `/dashboard/finance?invoice=${encodeURIComponent(invoiceId)}&focus=collect&amount=${amount}`,
      label: kind === 'deposit' ? 'Request deposit' : 'Create balance payment',
    };
  }
  switch (kind) {
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
