/**
 * Lead flow (Finance v3 proposal). Pure model: jobs + enquiries + orders of ONE organisation
 * → source → Contacted → Quoted → Invoiced → Deposit paid → Fixed, with the drop-offs.
 * Only real fields are used (SELECT-only check, 14 Oct 2026, SM):
 *  - source: enquiries.channel/sub_type for the person (web quote form / web contact form),
 *    else jobs.source (email / manual / website). utm_* and gclid are captured by the schema
 *    but are EMPTY on every SM enquiry, so Google Ads / FD referral / brochure cannot be split yet.
 *  - stage: jobs.stage (+ paid_at / orders.deposit_date for "deposit paid", installation_date
 *    in the past for "fixed"). Contacted = we sent anything (conversation.last_outbound_at) or later stage.
 */
export const STEPS = ['Contacted', 'Quoted', 'Invoiced', 'Deposit paid', 'Fixed'] as const;
export type Step = (typeof STEPS)[number];

export interface FlowJob {
  id: string; stage: string | null; source: string | null; created_at: string; exit_reason: string | null; paid_at: string | null;
  person_id: string | null; person_name: string; conversation_id: string | null; last_outbound_at: string | null;
}
export interface FlowEnquiry { person_id: string | null; channel: string | null; sub_type: string | null; product: string | null; price: number | null; order_id: string | null; created_at: string }
export interface FlowOrder { id: string; job_id: string | null; value: number; product: string | null; deposit_date: string | null; installation_date: string | null }

export interface Deal { job: FlowJob; source: string; reached: number; value: number | null; orderId: string | null; product: string | null }

const RANK: Record<string, number> = { enquired: 0, quoted: 2, invoiced: 3, confirmed: 4, in_production: 4, fixed: 5, complete: 5 };

export function sourceLabel(e: FlowEnquiry | undefined, jobSource: string | null): string {
  if (e?.channel === 'quote') return 'Web quote form';
  if (e?.channel === 'contact') return 'Web contact form';
  if (e?.channel === 'shortlist') return 'Web shortlist';
  if (jobSource === 'email') return 'Email';
  if (jobSource === 'manual') return 'Phone / manual';
  return 'Website (other)';
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
    return { job: j, source: sourceLabel(e, j.source), reached: r, value: o?.value ?? e?.price ?? null, orderId: o?.id ?? null, product: o?.product ?? e?.product ?? null };
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
