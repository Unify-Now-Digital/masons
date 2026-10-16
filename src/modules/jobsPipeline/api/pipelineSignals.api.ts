import { isTestPerson } from '../utils/testDeals';
/**
 * Read-only signals for the opportunities list (SELECT only, no writes, no DB change):
 * - last inbound / outbound per job across the family's org-scoped conversations
 * - latest quote £ in the family's outbound Gmail (this org's inbox only: SM never sees CM)
 * - deposits landed this month (for the admin forecast)
 */
import { supabase } from '@/shared/lib/supabase';
import type { PipelineJob } from '../types/jobsPipeline.types';
import { combineSignals, type ConvRow, type MsgRow, type PipelineSignals } from '../utils/signals';
export type { PipelineSignals };


const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const maxIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

export async function fetchPipelineSignals(organizationId: string, jobs: PipelineJob[], includeQuoteMail = true): Promise<PipelineSignals> {
  const personIds = [...new Set(jobs.map((j) => j.person_id).filter(Boolean))] as string[];
  const jobConvIds = [...new Set(jobs.map((j) => j.conversation_id).filter(Boolean))] as string[];
  const convs = new Map<string, ConvRow>();
  const cols = 'id, person_id, channel, last_inbound_at, last_outbound_at';
  for (const ids of chunk(personIds, 150)) {
    const { data, error } = await supabase.from('inbox_conversations').select(cols).eq('organization_id', organizationId).in('person_id', ids);
    if (error) throw error;
    for (const c of (data ?? []) as ConvRow[]) convs.set(c.id, c);
  }
  for (const ids of chunk(jobConvIds.filter((id) => !convs.has(id)), 150)) {
    const { data, error } = await supabase.from('inbox_conversations').select(cols).eq('organization_id', organizationId).in('id', ids);
    if (error) throw error;
    for (const c of (data ?? []) as ConvRow[]) convs.set(c.id, c);
  }

  // Outbound emails that mention a total, newest first (server-side filter keeps the payload small).
  const emailIds = includeQuoteMail ? [...convs.values()].filter((c) => c.channel === 'email').map((c) => c.id) : [];
  const msgs: MsgRow[] = [];
  for (const ids of chunk(emailIds, 100)) {
    const { data, error } = await supabase
      .from('inbox_messages')
      .select('conversation_id, sent_at, body_text')
      .eq('organization_id', organizationId)
      .eq('channel', 'email')
      .eq('direction', 'outbound')
      .in('conversation_id', ids)
      .or('body_text.ilike.*total*£*,body_text.ilike.*quote*£*')
      .order('sent_at', { ascending: false })
      .limit(1000);
    if (error) throw error;
    msgs.push(...((data ?? []) as MsgRow[]));
  }

  return combineSignals(jobs, [...convs.values()], msgs);
}


/** Deposits landed this calendar month (jobs.paid_at), valued by invoice total or enquiry price. */
export async function fetchClosedThisMonth(organizationId: string, now = new Date()): Promise<{ id: string; value: number }[]> {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data, error } = await supabase
    .from('jobs')
    .select('id, paid_at, enquiry_id, person:people(first_name, last_name, email, is_test)')
    .eq('organization_id', organizationId)
    .gte('paid_at', start);
  if (error) throw error;
  const real = (data ?? []).filter((j) => !isTestPerson(j.person as unknown as Parameters<typeof isTestPerson>[0]));
  const ids = real.map((j) => j.id as string);
  const inv = new Map<string, number>();
  if (ids.length) {
    const { data: rows, error: e2 } = await supabase.from('invoices').select('job_id, amount, deleted_at').in('job_id', ids);
    if (e2) throw e2;
    for (const r of rows ?? []) if (!r.deleted_at) inv.set(r.job_id, (inv.get(r.job_id) ?? 0) + (Number(r.amount) || 0));
  }
  const enquiryIds = real.map((j) => j.enquiry_id as string | null).filter(Boolean) as string[];
  const prices = new Map<string, number>();
  if (enquiryIds.length) {
    const { data: details } = await supabase.from('enquiry_details_safe').select('id, details').in('id', enquiryIds);
    for (const row of details ?? []) {
      const price = Number((row.details as { price?: unknown } | null)?.price);
      if (Number.isFinite(price)) prices.set(row.id as string, price);
    }
  }
  return real.map((j) => ({
    id: j.id as string,
    value: inv.get(j.id as string) || prices.get(j.enquiry_id as string) || 0,
  }));
}
