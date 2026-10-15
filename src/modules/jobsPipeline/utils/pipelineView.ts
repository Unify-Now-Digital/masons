/**
 * pipeline-v1 view model (pure). Uses only stored job / enquiry / invoice data:
 * - value: invoice total (Invoiced) or quoted enquiry price; otherwise honest text
 * - quiet: days since the last message on the job's conversation (falls back to
 *   jobs.updated_at when there is no linked conversation) vs a per-stage rule
 * - weighted value: ASSUMED stage odds (marked * in the UI)
 */
import type { NextAction } from '@/shared/lib/nextAction';
import type { JobInvoiceSummary, JobStage, PipelineJob } from '../types/jobsPipeline.types';
import { getJobEnquiryPrice } from './display';

const DAY = 86_400_000;

/** "Goes quiet after" rule per before-payment stage, in days. */
export const QUIET_AFTER_DAYS: Partial<Record<JobStage, number>> = { enquired: 2, quoted: 14, invoiced: 7 };
/** Assumed stage odds for the weighted value (illustrative, flagged with *). */
export const STAGE_ODDS: Partial<Record<JobStage, number>> = { enquired: 0.1, quoted: 0.4, invoiced: 0.8 };

export function jobValue(job: PipelineJob, inv?: JobInvoiceSummary): number | null {
  // A £0 invoice is a real (zero) value; only a missing invoice total is unknown.
  if (job.stage === 'invoiced') return inv && inv.count > 0 && Number.isFinite(inv.totalAmount) ? inv.totalAmount : null;
  return getJobEnquiryPrice(job);
}

export function jobValueLabel(job: PipelineJob, inv?: JobInvoiceSummary): string | null {
  if (jobValue(job, inv) != null) return null;
  return job.stage === 'enquired' ? 'Not quoted yet' : 'Price not recorded';
}

/** Last customer contact we know of: the conversation's last message, else the job's last change. */
export function lastContactAt(job: PipelineJob): string {
  return job.conversation?.last_message_at || job.updated_at || job.created_at;
}

export function quietDays(job: PipelineJob, now: Date = new Date()): number {
  const t = new Date(lastContactAt(job)).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now.getTime() - t) / DAY));
}

export function isGoneQuiet(job: PipelineJob, now: Date = new Date()): boolean {
  const rule = QUIET_AFTER_DAYS[job.stage];
  return rule != null && quietDays(job, now) >= rule;
}

/** Words + icon tone for the card timer, e.g. "Quiet 2mo" (red) or "3d" (neutral). */
export function quietText(job: PipelineJob, now: Date = new Date()): { text: string; tone: 'over' | 'neutral' } {
  const d = quietDays(job, now);
  const span = d < 1 ? 'today' : d < 7 ? `${d}d` : d < 70 ? `${Math.floor(d / 7)}w` : `${Math.floor(d / 30)}mo`;
  if (isGoneQuiet(job, now)) return { text: job.stage === 'enquired' ? `No reply · ${span}` : `Quiet ${span}`, tone: 'over' };
  return { text: span === 'today' ? 'Today' : `${span} ago`, tone: 'neutral' };
}

/** One next-step pill per before-payment card. */
export function jobNextStep(job: PipelineJob, inv?: JobInvoiceSummary, now: Date = new Date()): NextAction {
  const quiet = isGoneQuiet(job, now);
  const tone = quiet ? 'red' : 'neutral';
  switch (job.stage) {
    case 'enquired':
      return { kind: 'follow', label: 'Reply to enquiry', tone, reason: quiet ? 'Enquiry gone quiet' : 'New enquiry' };
    case 'quoted':
      if ((inv?.count ?? 0) > 0)
        return { kind: 'deposit', label: 'Chase deposit', tone, reason: 'Invoice sent · move to Invoiced' };
      return { kind: 'follow', label: 'Chase quote', tone, reason: quiet ? 'Quote gone quiet' : 'Quote sent' };
    case 'invoiced':
      return { kind: 'deposit', label: 'Chase deposit', tone, reason: quiet ? 'Deposit not paid, gone quiet' : 'Deposit not paid' };
    default:
      return { kind: 'none', label: '', tone: 'neutral', reason: '' };
  }
}

/** Quoted card that already has a linked invoice: offer the move (flag, not auto-move). */
export function shouldFlagMoveToInvoiced(job: PipelineJob, inv?: JobInvoiceSummary): boolean {
  return job.stage === 'quoted' && (inv?.count ?? 0) > 0;
}

export interface ColumnSummary {
  count: number;
  total: number;
  priced: number;
  weighted: number;
  quietAfterDays: number | null;
}

export function columnSummary(stage: JobStage, jobs: PipelineJob[], invs: Map<string, JobInvoiceSummary>): ColumnSummary {
  let total = 0, priced = 0;
  for (const j of jobs) {
    const v = jobValue(j, invs.get(j.id));
    if (v != null) { total += v; priced += 1; }
  }
  const odds = STAGE_ODDS[stage] ?? 0;
  return { count: jobs.length, total, priced, weighted: Math.round(total * odds * 100) / 100, quietAfterDays: QUIET_AFTER_DAYS[stage] ?? null };
}

export type UpNextGroup = 'quiet' | 'open';

/**
 * Up next list: gone-quiet jobs first ("Gone quiet: chase"), then the rest; within
 * a group, highest value first, then longest quiet.
 */
export function upNext(
  jobs: PipelineJob[],
  invs: Map<string, JobInvoiceSummary>,
  now: Date = new Date(),
): { group: UpNextGroup; jobs: PipelineJob[] }[] {
  const keys = new Map(jobs.map((j) => [j.id, [jobValue(j, invs.get(j.id)) ?? -1, quietDays(j, now)] as const]));
  const key = (j: PipelineJob) => keys.get(j.id)!;
  const sort = (list: PipelineJob[]) =>
    [...list].sort((a, b) => key(b)[0] - key(a)[0] || key(b)[1] - key(a)[1]);
  const quiet = sort(jobs.filter((j) => isGoneQuiet(j, now)));
  const open = sort(jobs.filter((j) => !isGoneQuiet(j, now)));
  return [
    ...(quiet.length ? [{ group: 'quiet' as const, jobs: quiet }] : []),
    ...(open.length ? [{ group: 'open' as const, jobs: open }] : []),
  ];
}

export type PipelineFilter = 'all' | 'quiet' | 'not_quiet';

export function filterJobs(jobs: PipelineJob[], filter: PipelineFilter, source: string | null, now: Date = new Date()) {
  return jobs.filter(
    (j) =>
      (source == null || j.source === source) &&
      (filter === 'all' || (filter === 'quiet' ? isGoneQuiet(j, now) : !isGoneQuiet(j, now))),
  );
}
