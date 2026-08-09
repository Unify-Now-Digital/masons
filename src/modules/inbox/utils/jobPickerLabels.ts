import type { JobStage } from '@/modules/jobsPipeline';
import { formatStageLabel } from '@/modules/jobsPipeline';
import { formatOrderTypeLabel } from '@/modules/orders/utils/orderTypeDisplay';
import type { Order } from '@/modules/orders/types/orders.types';

/** Structural subset of jobsPipeline's ConversationJobSummary (type not barrel-exported). */
export interface PickerJob {
  id: string;
  conversation_id: string;
  stage: JobStage;
  exit_reason: string | null;
  created_at: string;
}

export interface JobPickerEntry {
  job: PickerJob;
  jobNumber: number;
  orderLabel: string | null;
  stageLabel: string;
  isExited: boolean;
  label: string;
}

/**
 * FR-2 selection rule — the ONLY implementation; both header and panel call this.
 * `jobs` arrives newest-first (fetchConversationsJobs order). A stale/absent
 * selectedJobId falls back to: newest active, else newest, else null.
 */
export function effectiveJobId(
  jobs: PickerJob[] | undefined,
  selectedJobId: string | null,
): string | null {
  if (!jobs || jobs.length === 0) return null;
  if (selectedJobId && jobs.some((j) => j.id === selectedJobId)) return selectedJobId;
  return (jobs.find((j) => !j.exit_reason) ?? jobs[0]).id;
}

/** Newest order per job (label source). Orders with job_id = null label no job (FR-7). */
export function buildOrdersByJobId(orders: Order[]): Map<string, Order> {
  const byJob = new Map<string, Order>();
  for (const order of orders) {
    if (!order.job_id) continue;
    const current = byJob.get(order.job_id);
    if (!current || order.created_at > current.created_at) byJob.set(order.job_id, order);
  }
  return byJob;
}

/**
 * FR-3 entries. Display order = input order (newest first); "Job N" numbering is
 * independent: created_at ascending, id ascending on ties (identical timestamps
 * exist in production — OQ-B).
 */
export function buildJobPickerEntries(
  jobs: PickerJob[],
  ordersByJobId: Map<string, Order>,
): JobPickerEntry[] {
  const numberById = new Map<string, number>();
  [...jobs]
    .sort((a, b) =>
      a.created_at < b.created_at ? -1 :
      a.created_at > b.created_at ? 1 :
      a.id < b.id ? -1 : 1,
    )
    .forEach((job, index) => numberById.set(job.id, index + 1));

  return jobs.map((job) => {
    const jobNumber = numberById.get(job.id) as number;
    const linkedOrder = ordersByJobId.get(job.id);
    const orderLabel = linkedOrder ? formatOrderTypeLabel(linkedOrder.order_type) : null;
    const stageLabel = formatStageLabel(job.stage);
    return {
      job,
      jobNumber,
      orderLabel,
      stageLabel,
      isExited: job.exit_reason != null,
      label: orderLabel
        ? `Job ${jobNumber} — ${orderLabel} — ${stageLabel}`
        : `Job ${jobNumber} — ${stageLabel}`,
    };
  });
}
