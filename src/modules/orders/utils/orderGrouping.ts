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
