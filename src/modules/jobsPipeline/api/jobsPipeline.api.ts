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
  '*, person:people(id, first_name, last_name, email, phone, is_test), ' +
  'conversation:inbox_conversations(id, primary_handle, channel, last_message_at), ' +
  'enquiry:enquiries!enquiry_id(id, channel, lead_source)';

async function attachEnquiryPrices(jobs: PipelineJob[]): Promise<PipelineJob[]> {
  const ids = [...new Set(jobs.map((job) => job.enquiry?.id).filter(Boolean))] as string[];
  if (ids.length === 0) return jobs;
  const { data } = await supabase.from('enquiry_details_safe').select('id, details').in('id', ids);
  const byId = new Map((data ?? []).map((row) => [row.id as string, row.details as { price?: unknown; permit_fee?: unknown } | null]));
  return jobs.map((job) => {
    if (!job.enquiry?.id) return job;
    const details = byId.get(job.enquiry.id);
    const price = details?.price == null ? null : String(details.price);
    const permit = details?.permit_fee == null ? null : String(details.permit_fee);
    return { ...job, enquiry: { ...job.enquiry, price, permit_fee: permit } };
  });
}

export async function fetchActiveJobs(organizationId: string): Promise<PipelineJob[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('organization_id', organizationId)
    .is('exit_reason', null)
    .is('paid_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return attachEnquiryPrices((data ?? []) as unknown as PipelineJob[]);
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
  return attachEnquiryPrices((data ?? []) as unknown as PipelineJob[]);
}

export async function fetchExitedJobs(organizationId: string): Promise<PipelineJob[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('organization_id', organizationId)
    .not('exit_reason', 'is', null)
    .order('exited_at', { ascending: false });
  if (error) throw error;
  return attachEnquiryPrices((data ?? []) as unknown as PipelineJob[]);
}

export interface JobOrderFigure {
  id: string;
  total: number;
  invoiceSent: boolean;
  invoiceAmount: number | null;
}

const figureChunk = <T,>(rows: T[], size: number) =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, index * size + size));

/**
 * Newest order on each job, with the order total (memorial + permit) and whether
 * an invoice exists. A deposit invoice's amount is kept aside so it cannot
 * replace the order total. Owners only: the money views 403 for everyone else.
 */
export async function fetchJobOrderFigures(
  organizationId: string,
  canSeeMoney: boolean,
): Promise<Map<string, JobOrderFigure>> {
  const out = new Map<string, JobOrderFigure>();
  if (!canSeeMoney) return out;
  const { data, error } = await supabase
    .from('orders')
    .select('id, job_id, created_at')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .not('job_id', 'is', null);
  if (error) throw error;
  const newest = new Map<string, { id: string; created_at: string }>();
  for (const row of data ?? []) {
    if (!row.job_id) continue;
    const current = newest.get(row.job_id);
    if (!current || (row.created_at ?? '') > current.created_at) {
      newest.set(row.job_id, { id: row.id, created_at: row.created_at ?? '' });
    }
  }
  const ids = [...newest.values()].map((row) => row.id);
  const amountById = new Map<string, { value: number; permit: number }>();
  const invoiceByOrder = new Map<string, { amount: number; sent: boolean }>();
  for (const slice of figureChunk(ids, 100)) {
    const [amounts, invoices] = await Promise.all([
      supabase.from('order_amounts').select('id, value, permit_cost').in('id', slice),
      supabase.from('invoices').select('order_id, amount, status, deleted_at').in('order_id', slice),
    ]);
    if (amounts.error) throw amounts.error;
    if (invoices.error) throw invoices.error;
    for (const row of amounts.data ?? []) {
      amountById.set(row.id, { value: Number(row.value) || 0, permit: Number(row.permit_cost) || 0 });
    }
    for (const row of invoices.data ?? []) {
      if (!row.order_id || row.deleted_at || row.status === 'void') continue;
      const amount = Number(row.amount) || 0;
      const current = invoiceByOrder.get(row.order_id);
      invoiceByOrder.set(row.order_id, {
        amount: Math.max(current?.amount ?? 0, amount),
        sent: true,
      });
    }
  }
  for (const [jobId, order] of newest) {
    const money = amountById.get(order.id);
    const invoice = invoiceByOrder.get(order.id);
    out.set(jobId, {
      id: order.id,
      total: (money?.value ?? 0) + (money?.permit ?? 0),
      invoiceSent: !!invoice?.sent,
      invoiceAmount: invoice?.sent ? invoice.amount : null,
    });
  }
  return out;
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

/** All jobs linked to a person, newest first. Org-guarded. */
export async function fetchJobsByPersonId(
  personId: string,
  organizationId: string,
): Promise<ConversationJobSummary[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, conversation_id, stage, exit_reason, paid_at, created_at')
    .eq('person_id', personId)
    .eq('organization_id', organizationId)
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
