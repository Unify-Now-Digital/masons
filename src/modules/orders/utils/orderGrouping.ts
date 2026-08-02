import type { JobStage } from '@/modules/jobsPipeline';

// Customers boundary is pre-invoiced — NOT the same axis as the pipeline's
// BEFORE_PAID_STAGES (pre-paid), which is why these sets are defined here.
export const CUSTOMER_STAGES: readonly JobStage[] = [
  'invoiced',
  'confirmed',
  'in_production',
  'fixed',
  'complete',
];

export const ENQUIRY_STAGES: readonly JobStage[] = ['enquired', 'quoted'];

export type OrderGroup = 'customers' | 'enquiries' | 'unassigned';

/**
 * Single grouping authority for the Orders page tabs AND the Client badge —
 * both must derive from this so they can never contradict each other.
 * null/undefined covers job_id IS NULL, orphaned references, and RLS-filtered
 * jobs alike (the embed returns null for all three). Ignores paid_at and
 * exit_reason by design — those are separate axes.
 */
export function getOrderGroup(job: { stage: JobStage } | null | undefined): OrderGroup {
  if (!job) return 'unassigned';
  return (ENQUIRY_STAGES as readonly string[]).includes(job.stage) ? 'enquiries' : 'customers';
}
