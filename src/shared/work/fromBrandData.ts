/**
 * BrandData (the Hub/Finance rows useBrandData already loads) → WorkItem[]. Pure, no React.
 * This is the composition step behind useWorkItems(): it maps the existing rows onto the
 * per-lane adapter inputs, runs the adapters, stamps urgency (sla.ts) and ranks (rank.ts).
 * No new queries (B.3): proofs read orders.proof_status because order_proofs isn't loaded.
 */
import type { BrandData, OrderRow } from '@/modules/today/brandData.types';
import { isTestOrder, isVoidInStripe, num, orderName, orderRef, orderTotal, receivables } from '@/modules/finance/receivables';
import { fromConversation, fromOrderPermit, fromOrderProof, fromReceivable } from './adapters';
import { withUrgency } from './sla';
import { rank } from './rank';
import type { Lane, WorkItem } from './types';

const DAY = 86_400_000;
const SALES_STAGES = new Set(['enquired', 'quoted', 'invoiced']);
const OPEN_ORDER_STAGES = new Set(['confirmed', 'in_production', 'fixed']);
const isOpenOrder = (o: OrderRow) => !isTestOrder(o) && !o.job?.exit_reason && OPEN_ORDER_STAGES.has(o.job?.stage ?? '');

const personName = (p: BrandData['jobs'][number]['person']) =>
  [p?.first_name?.trim(), p?.last_name?.trim()].filter(Boolean).join(' ') || p?.email || 'Unknown';

const maxIso = (vals: (string | null)[]) => vals.reduce<string | null>((m, v) => (v && (!m || v > m) ? v : m), null);

export interface BuildOptions { lanes?: Lane[]; orderId?: string; canSeeMoney?: boolean }

export function workItemsFromBrandData(d: BrandData, now: Date, opts: BuildOptions = {}): WorkItem[] {
  const want = (l: Lane) => !opts.lanes || opts.lanes.includes(l);
  const nowMs = now.getTime();
  const out: (WorkItem | null)[] = [];
  const orderById = new Map(d.orders.map((o) => [o.id, o]));
  const orderByJob = new Map(d.orders.filter((o) => o.job_id).map((o) => [o.job_id!, o]));

  if (want('sales')) {
    const quoteByPerson = new Map<string, number>();
    for (const e of d.enquiries ?? []) {
      const p = e.details?.price != null ? num(e.details.price) : 0;
      if (e.person_id && p > 0 && !quoteByPerson.has(e.person_id)) quoteByPerson.set(e.person_id, p);
    }
    for (const j of d.jobs) {
      if (j.exit_reason || j.person?.is_test || !SALES_STAGES.has(j.stage ?? '')) continue;
      const order = orderByJob.get(j.id);
      const quote = j.person_id ? quoteByPerson.get(j.person_id) ?? null : null;
      out.push(fromConversation({
        lane: 'sales', jobId: j.id, personId: j.person_id, conversationId: j.conversation?.id ?? null,
        jobStage: j.stage, jobExitReason: j.exit_reason, createdAt: j.created_at,
        lastInboundAt: j.conversation?.last_inbound_at ?? null, lastOutboundAt: j.conversation?.last_outbound_at ?? null,
        name: personName(j.person), orderId: order?.id ?? null, orderRef: order ? orderRef(order) : null,
        value: order ? orderTotal(order) : quote, valueIsEstimate: !order && quote != null,
      }));
    }
  }

  for (const o of d.orders) {
    if (!isOpenOrder(o)) continue;
    if (want('cs')) {
      const convs = d.convs.filter((c) => c.order_id === o.id);
      out.push(fromConversation({
        lane: 'cs', orderId: o.id, personId: o.person_id, conversationId: null, name: orderName(o), orderRef: orderRef(o),
        value: orderTotal(o), createdAt: o.created_at,
        lastInboundAt: maxIso(convs.map((c) => c.last_inbound_at)), lastOutboundAt: maxIso(convs.map((c) => c.last_outbound_at)),
      }));
    }
    if (want('proof')) {
      out.push(fromOrderProof({
        orderId: o.id, orderExitReason: o.job?.exit_reason ?? null, state: null, proofStatus: o.proof_status,
        sentAt: null, changesRequestedAt: null, createdAt: o.created_at, name: orderName(o), ref: orderRef(o), value: orderTotal(o),
      }));
    }
  }

  if (want('permit')) {
    for (const p of d.permits) {
      const o = orderById.get(p.order_id);
      if (!o || isTestOrder(o)) continue;
      out.push(fromOrderPermit({
        orderId: o.id, orderExitReason: o.job?.exit_reason ?? null, permitPhase: p.permit_phase,
        sentAt: p.sent_at, submittedAt: p.submitted_at, stageEnteredAt: p.stage_entered_at,
        createdAt: p.stage_entered_at ?? p.sent_at ?? o.created_at, name: orderName(o), ref: orderRef(o), value: orderTotal(o),
      }));
    }
  }

  if (want('payment') && opts.canSeeMoney !== false) {
    for (const r of receivables(d, nowMs)) {
      // Same rule as the Hub's financeItems(): no deposit and quiet 60d+ is a stale pipeline job.
      if (!r.depositIn && (r.ageDays ?? 0) >= 60) continue;
      const liveInv = r.openInvoice && !isVoidInStripe(r.openInvoice) ? r.openInvoice : null;
      const o = orderById.get(r.orderId);
      const balanceRequested = r.depositIn && !!liveInv;
      out.push(fromReceivable({
        kind: 'order', orderId: r.orderId, isOpen: true, depositPaid: r.depositIn,
        depositUnrecorded: r.action === 'Record payment', depositInvoiced: !r.depositIn && !!liveInv,
        balanceDue: r.action === 'Request balance' || balanceRequested, balanceRequested,
        remainingPence: Math.round(r.remaining * 100),
        since: liveInv ? (liveInv.issue_date ?? liveInv.created_at)
          : r.ageDays != null ? new Date(nowMs - r.ageDays * DAY).toISOString() : (o?.created_at ?? now.toISOString()),
        name: r.name, ref: r.ref,
      }, now));
    }
    for (const p of d.orderPayments) {
      if (p.status === 'matched') continue;
      out.push(fromReceivable({
        kind: 'unmatched_payment', paymentId: p.id, amountPounds: num(p.amount), receivedAt: p.received_at, reference: p.reference, source: p.source,
      }, now));
    }
  }

  const items = out
    .filter((i): i is WorkItem => i != null)
    .filter((i) => !opts.orderId || i.orderId === opts.orderId)
    .map((i) => withUrgency(i, now));
  return rank(items, now);
}
