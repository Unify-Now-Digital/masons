import { supabase } from '@/shared/lib/supabase';
import { BEFORE_PAID_STAGES } from '../types/jobsPipeline.types';

/** The two blessed automation targets — other stages are unrepresentable. */
export type AutoAdvanceTargetStage = 'quoted' | 'invoiced';

/**
 * Forward-only stage automation fired after an order/invoice is created on a
 * job. NOT moveJobStage: deliberately no adjacency rule (enquired → invoiced
 * jumps are expected) and no invoiced-gate probe — the caller fires this
 * because an invoice/order was just created, satisfying the gate's intent by
 * construction.
 *
 * Every no-op condition is a WHERE predicate on one atomic UPDATE — wrong org,
 * job not found, exited, post-paid, or already at/past target all match zero
 * rows, with no read-then-write race between concurrent fires.
 *
 * @returns true iff the job actually advanced (callers skip cache
 * invalidation on false). Throws on transport/DB errors; containment is the
 * caller's job — creation must never fail because of this.
 */
export async function autoAdvanceJobStage(args: {
  organizationId: string;
  jobId: string;
  targetStage: AutoAdvanceTargetStage;
}): Promise<boolean> {
  const { organizationId, jobId, targetStage } = args;
  // Stages strictly earlier than the target on the before-paid axis:
  // 'quoted' → ['enquired'];  'invoiced' → ['enquired', 'quoted'].
  const earlierStages = BEFORE_PAID_STAGES.slice(0, BEFORE_PAID_STAGES.indexOf(targetStage));

  const { data, error } = await supabase
    .from('jobs')
    .update({ stage: targetStage })
    .eq('id', jobId)
    .eq('organization_id', organizationId)
    .is('exit_reason', null)
    .in('stage', earlierStages as unknown as string[])
    .select('id');

  if (error) throw error;
  return (data ?? []).length > 0;
}
