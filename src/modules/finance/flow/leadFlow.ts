import { normalizeLeadSource } from '@/shared/lib/leadSource';

/**
 * Lead flow (Finance v3 proposal). Pure model: jobs + enquiries + orders of ONE organisation
 * → source → Contacted → Quoted → Invoiced → Deposit paid → Fixed, with the drop-offs.
 * Only real fields are used:
 *  - source (15 Oct 2026): jobs.lead_source, else the person's first enquiries.lead_source
 *    (vocab in shared/lib/leadSource). Rows with neither read "Not recorded" — never guessed.
 *  - stage: jobs.stage (+ paid_at / orders.deposit_date for "deposit paid", installation_date
 *    in the past for "fixed"). Contacted = we sent anything (conversation.last_outbound_at) or later stage.
 */
export const STEPS = ['Contacted', 'Quoted', 'Invoiced', 'Deposit paid', 'Fixed'] as const;
export type Step = (typeof STEPS)[number];

export interface FlowJob {
  id: string; stage: string | null; source: string | null; created_at: string; exit_reason: string | null; paid_at: string | null;
  person_id: string | null; person_name: string; conversation_id: string | null; last_outbound_at: string | null;
  lead_source?: string | null;
}
export interface FlowEnquiry { person_id: string | null; channel: string | null; lead_source?: string | null; sub_type: string | null; product: string | null; price: number | null; order_id: string | null; created_at: string }
export interface FlowOrder { id: string; job_id: string | null; value: number; product: string | null; deposit_date: string | null; installation_date: string | null }

export interface Deal { job: FlowJob; source: string; reached: number; value: number | null; orderId: string | null; product: string | null }

const RANK: Record<string, number> = { enquired: 0, quoted: 2, invoiced: 3, confirmed: 4, in_production: 4, fixed: 5, complete: 5 };

export const NOT_RECORDED = 'Not recorded';
export function sourceLabel(e: FlowEnquiry | undefined, job: Pick<FlowJob, 'lead_source'>): string {
  return normalizeLeadSource(job.lead_source) ?? normalizeLeadSource(e?.lead_source) ?? NOT_RECORDED;
}

export function buildDeals(jobs: FlowJob[], enq: FlowEnquiry[], orders: FlowOrder[], now = Date.now()): Deal[] {
  const firstEnq = new Map<string, FlowEnquiry>();
  for (const e of [...enq].sort((a, b) => a.created_at.localeCompare(b.created_at))) if (e.person_id && !firstEnq.has(e.person_id)) firstEnq.set(e.person_id, e);
  const orderByJob = new Map(orders.filter((o) => o.job_id).map((o) => [o.job_id!, o]));
  return jobs.map((j) => {
    const e = j.person_id ? firstEnq.get(j.person_id) : undefined;
    const o = orderByJob.get(j.id);
    let r = RANK[j.stage ?? ''] ?? 0;
    if (r < 1 && j.last_outbound_at) r = 1;
    if (r >= 1 && r < 4 && (j.paid_at || o?.deposit_date)) r = 4;
    if (r === 4 && o?.installation_date && Date.parse(o.installation_date) < now) r = 5;
    return { job: j, source: sourceLabel(e, j), reached: r, value: o?.value ?? e?.price ?? null, orderId: o?.id ?? null, product: o?.product ?? e?.product ?? null };
  });
}

export interface FlowLink { from: string; to: string; deals: Deal[] }
/** Links: source → Contacted | "Not contacted yet"; step k → step k+1 | "Stopped at step k" (open) | "Closed". */
export function buildLinks(deals: Deal[]): FlowLink[] {
  const m = new Map<string, FlowLink>();
  const add = (from: string, to: string, d: Deal) => { const k = `${from}→${to}`; (m.get(k) ?? m.set(k, { from, to, deals: [] }).get(k)!).deals.push(d); };
  for (const d of deals) {
    const closed = !!d.job.exit_reason;
    // Node ids are "label@column" so each drop-off sits right of the step it fell from.
    if (d.reached < 1) { add(`${d.source}@0`, closed ? 'Closed@1' : 'Not contacted yet@1', d); continue; }
    add(`${d.source}@0`, 'Contacted@1', d);
    for (let k = 1; k < 5; k++) {
      if (d.reached > k) add(`${STEPS[k - 1]}@${k}`, `${STEPS[k]}@${k + 1}`, d);
      else { add(`${STEPS[k - 1]}@${k}`, closed ? `Closed@${k + 1}` : `Still open@${k + 1}`, d); break; }
    }
  }
  return [...m.values()];
}

/* ── Arin's style (14 Oct, 23:13): sources merge into one shared pipeline column, then split into outcomes. ── */
export const MID = ['Enquiry', 'Quoted', 'Invoiced'] as const;
/** 'Abandoned' = job exited (jobs.exit_reason set) before a deposit. */
export const OUTCOMES = ['Deposit paid', 'Fixed', 'Open', 'Abandoned'] as const;
export const midOf = (d: Deal) => (d.reached >= 3 ? 'Invoiced' : d.reached === 2 ? 'Quoted' : 'Enquiry');
export const outcomeOf = (d: Deal) => (d.reached >= 5 ? 'Fixed' : d.reached >= 4 ? 'Deposit paid' : d.job.exit_reason ? 'Abandoned' : 'Open');

export interface Ribbon { source: string; from: string; to: string; deals: Deal[] }
/** One ribbon per (source, hop): colour stays with the source through the whole flow. */
export function buildRibbons(deals: Deal[]): Ribbon[] {
  const m = new Map<string, Ribbon>();
  const add = (source: string, from: string, to: string, d: Deal) => {
    const k = `${source}|${from}|${to}`;
    (m.get(k) ?? m.set(k, { source, from, to, deals: [] }).get(k)!).deals.push(d);
  };
  for (const d of deals) {
    const mid = `${midOf(d)}@1`;
    add(d.source, `${d.source}@0`, mid, d);
    add(d.source, mid, `${outcomeOf(d)}@2`, d);
  }
  return [...m.values()];
}

/* ── Finance by lead source (15 Oct 2026) ── */
export interface SourceRow {
  source: string; leads: number; quotes: number; deposits: number; revenue: number;
  /** Google Ads only: spend in the range; null = not loaded / not applicable. */
  spend: number | null; costPerDeposit: number | null;
}
/**
 * leads = deals created in range · quotes = reached Quoted or later · deposits = reached Deposit paid
 * · revenue = linked order value (value + permit, as in the flow) of deposit-paid deals.
 * Spend applies to Google Ads only (ads_spend_daily); cost per deposit = spend ÷ deposits.
 */
export function bySource(deals: Deal[], adsSpend: number | null): SourceRow[] {
  const m = new Map<string, SourceRow>();
  for (const d of deals) {
    const r = m.get(d.source) ?? m.set(d.source, { source: d.source, leads: 0, quotes: 0, deposits: 0, revenue: 0, spend: null, costPerDeposit: null }).get(d.source)!;
    r.leads++;
    if (d.reached >= 2) r.quotes++;
    if (d.reached >= 4) { r.deposits++; r.revenue += d.orderId ? d.value ?? 0 : 0; }
  }
  if (adsSpend != null) {
    const g = m.get('Google Ads') ?? m.set('Google Ads', { source: 'Google Ads', leads: 0, quotes: 0, deposits: 0, revenue: 0, spend: null, costPerDeposit: null }).get('Google Ads')!;
    g.spend = adsSpend; g.costPerDeposit = g.deposits ? adsSpend / g.deposits : null;
  }
  return [...m.values()].sort((a, b) => (a.source === NOT_RECORDED ? 1 : 0) - (b.source === NOT_RECORDED ? 1 : 0) || b.leads - a.leads);
}
