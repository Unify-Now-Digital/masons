import type { JobStage } from '@/modules/jobsPipeline';

// Badge vocabulary: partitions the stage axis at the *invoiced* boundary — an
// invoiced job is already a "customer" for the Client badge even though payment
// hasn't landed. Intentionally a different partition than the payment sections
// below; both are correct for their consumer.
export const CUSTOMER_STAGES: readonly JobStage[] = [
  'invoiced',
  'confirmed',
  'in_production',
  'fixed',
  'complete',
];

export const ENQUIRY_STAGES: readonly JobStage[] = ['enquired', 'quoted'];

// Tab-strip section vocabulary: partitions at the *payment* boundary, mirroring
// the pipeline page's Before/After payment split (jobsPipeline's BEFORE_PAID_
// STAGES/AFTER_PAID_STAGES aren't public exports, so the orders module owns its
// own copy — keep in sync with supabase jobs stage vocabulary).
export const ORDERS_BEFORE_PAYMENT_TABS: readonly JobStage[] = ['enquired', 'quoted', 'invoiced'];
export const ORDERS_AFTER_PAYMENT_TABS: readonly JobStage[] = [
  'confirmed',
  'in_production',
  'fixed',
  'complete',
];

// Since the stage-tabs feature, the Orders tabs share the pipeline's stage axis
// one-to-one; 'unassigned' covers orders with no resolvable job.
export type OrderGroup = JobStage | 'unassigned';

/** Tab-state vocabulary for OrdersPage — typed so stale tab literals fail to compile. */
export type OrdersTab = OrderGroup | 'all';

/**
 * Single grouping authority for the Orders page tabs AND the Client badge —
 * both must derive from this so they can never contradict each other.
 * null/undefined covers job_id IS NULL, orphaned references, and RLS-filtered
 * jobs alike (the embed returns null for all three). Ignores paid_at and
 * exit_reason by design — those are separate axes.
 */
export function getOrderGroup(job: { stage: JobStage } | null | undefined): OrderGroup {
  if (!job) return 'unassigned';
  return job.stage;
}

const ORDER_GROUPS: readonly OrderGroup[] = [
  'enquired', 'quoted', 'invoiced', 'confirmed', 'in_production', 'fixed', 'complete', 'unassigned',
];

/** Always on the strip, even at zero — the stages staff scan every day. */
const ALWAYS_SHOWN_TABS: readonly OrderGroup[] = ['invoiced', ...ORDERS_AFTER_PAYMENT_TABS];

function emptyTabCounts(): Record<OrdersTab, number> {
  return {
    enquired: 0, quoted: 0, invoiced: 0, confirmed: 0,
    in_production: 0, fixed: 0, complete: 0, unassigned: 0, all: 0,
  };
}

/**
 * Counts for the Orders tabs. A stage that isn't one of the known groups is
 * counted as Unassigned, so every order sits in exactly one bucket and the
 * buckets sum to All.
 */
export function orderTabCounts(orders: readonly { group: string }[]): Record<OrdersTab, number> {
  const counts = emptyTabCounts();
  const known = new Set<string>(ORDER_GROUPS);
  for (const order of orders) {
    const group = known.has(order.group) ? (order.group as OrderGroup) : 'unassigned';
    counts[group] += 1;
    counts.all += 1;
  }
  return counts;
}

/**
 * Tabs to render, in order. Enquired, Quoted and Unassigned appear when they
 * hold orders, so the numbers on the strip add up to All.
 */
export function orderTabValues(counts: Record<OrdersTab, number>): OrderGroup[] {
  const head: OrderGroup[] = (['enquired', 'quoted'] as const).filter((group) => counts[group] > 0);
  const tail: OrderGroup[] = counts.unassigned > 0 ? ['unassigned'] : [];
  return [...head, ...ALWAYS_SHOWN_TABS, ...tail];
}
