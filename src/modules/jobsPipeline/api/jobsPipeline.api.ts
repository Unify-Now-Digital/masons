import { supabase } from '@/shared/lib/supabase';
import {
  AFTER_PAID_STAGES,
  BEFORE_PAID_STAGES,
  type JobExitReason,
  type JobInvoiceSummary,
  type JobStage,
  type PipelineJob,
} from '../types/jobsPipeline.types';

const JOB_SELECT =
  '*, person:people(id, first_name, last_name, email, phone), ' +
  'conversation:inbox_conversations(id, primary_handle, channel)';

export async function fetchActiveJobs(organizationId: string): Promise<PipelineJob[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('organization_id', organizationId)
    .is('exit_reason', null)
    .is('paid_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PipelineJob[];
}

/**
 * After-paid board rows. Stage is the sole membership gate — deliberately no
 * paid_at predicate, so a post-paid-stage row with a null paid_at still renders
 * (with a warning) instead of silently vanishing.
 */
export async function fetchAfterPaidJobs(organizationId: string): Promise<PipelineJob[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('organization_id', organizationId)
    .is('exit_reason', null)
    .in('stage', AFTER_PAID_STAGES as unknown as string[])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PipelineJob[];
}

export async function fetchExitedJobs(organizationId: string): Promise<PipelineJob[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('organization_id', organizationId)
    .not('exit_reason', 'is', null)
    .order('exited_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PipelineJob[];
}

export async function fetchJobInvoiceSummaries(
  organizationId: string,
): Promise<Map<string, JobInvoiceSummary>> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, job_id, amount, deleted_at, status')
    .eq('organization_id', organizationId)
    .not('job_id', 'is', null);
  if (error) throw error;

  const summaries = new Map<string, JobInvoiceSummary>();
  for (const row of data ?? []) {
    if (row.deleted_at || !row.job_id) continue;
    const summary = summaries.get(row.job_id) ?? { count: 0, totalAmount: 0 };
    summary.count += 1;
    summary.totalAmount += Number(row.amount) || 0;
    summaries.set(row.job_id, summary);
  }
  return summaries;
}

export async function fetchConversationJob(
  conversationId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id')
    .eq('conversation_id', conversationId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Count of dormant jobs whose wake date has passed (head-only, no rows fetched). */
export async function fetchDueDormantCount(organizationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('exit_reason', 'dormant')
    .lte('wake_at', new Date().toISOString());
  if (error) throw error;
  return count ?? 0;
}

export interface ConversationJobSummary {
  id: string;
  conversation_id: string;
  stage: JobStage;
  exit_reason: JobExitReason | null;
  paid_at: string | null;
  created_at: string;
}

/** All jobs attached to any of the group's conversations, newest first. */
export async function fetchConversationsJobs(
  conversationIds: string[],
): Promise<ConversationJobSummary[]> {
  if (conversationIds.length === 0) return [];
  const { data, error } = await supabase
    .from('jobs')
    .select('id, conversation_id, stage, exit_reason, paid_at, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConversationJobSummary[];
}

/** Thrown when a move violates the Invoiced gate (D4) — surfaced as a toast, not a crash. */
export class InvoicedGateError extends Error {
  constructor() {
    super('No invoice linked to this job yet');
    this.name = 'InvoicedGateError';
  }
}

/** The ordered axis a stage belongs to — adjacency is only defined within one axis. */
function stageAxis(stage: JobStage): readonly JobStage[] | null {
  if ((BEFORE_PAID_STAGES as readonly string[]).includes(stage)) return BEFORE_PAID_STAGES;
  if ((AFTER_PAID_STAGES as readonly string[]).includes(stage)) return AFTER_PAID_STAGES;
  return null;
}

export async function moveJobStage(args: {
  organizationId: string;
  jobId: string;
  fromStage: JobStage;
  toStage: JobStage;
}): Promise<void> {
  const { organizationId, jobId, fromStage, toStage } = args;
  // Same axis + adjacent. Cross-axis moves (invoiced ↔ confirmed) fail the
  // axis-equality test from both directions — leaving an axis is not a board move.
  const axis = stageAxis(fromStage);
  if (
    !axis ||
    axis !== stageAxis(toStage) ||
    Math.abs(axis.indexOf(toStage) - axis.indexOf(fromStage)) !== 1
  ) {
    throw new Error(`Invalid stage move: ${fromStage} → ${toStage}`);
  }

  if (toStage === 'invoiced') {
    // Fresh probe at write time — the board's cached summary map may be stale.
    const { data: invoice, error: probeError } = await supabase
      .from('invoices')
      .select('id')
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (probeError) throw probeError;
    if (!invoice) throw new InvoicedGateError();
  }

  const { error } = await supabase
    .from('jobs')
    .update({ stage: toStage })
    .eq('id', jobId)
    .eq('organization_id', organizationId);
  if (error) throw error;
}

/** Clears the exit fields; the job returns to its stored stage (exiting never changed stage). */
export async function reopenJob(args: {
  organizationId: string;
  jobId: string;
}): Promise<void> {
  const { organizationId, jobId } = args;
  const { error } = await supabase
    .from('jobs')
    .update({ exit_reason: null, exited_at: null, wake_at: null })
    .eq('id', jobId)
    .eq('organization_id', organizationId);
  if (error) throw error;
}

export async function exitJob(args: {
  organizationId: string;
  jobId: string;
  reason: JobExitReason;
  wakeAt?: string | null;
}): Promise<void> {
  const { organizationId, jobId, reason, wakeAt } = args;
  if (reason === 'dormant' && !wakeAt) {
    throw new Error('A wake date is required to mark a job dormant');
  }
  const { error } = await supabase
    .from('jobs')
    .update({
      exit_reason: reason,
      exited_at: new Date().toISOString(),
      wake_at: reason === 'dormant' ? wakeAt : null,
    })
    .eq('id', jobId)
    .eq('organization_id', organizationId);
  if (error) throw error;
}
