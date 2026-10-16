/**
 * Raw brand rows → Today rows (one action each). Pure. See todayModel.ts for ranking.
 * Data notes: "last out" = inbox_conversations.last_outbound_at (outbound email/SMS/WhatsApp
 * we sent). YOPA call-handling is not an outbound message, so it never resets the clock.
 */
import { displayPersonName } from '@/shared/lib/personName';
import { proofAwaiting } from '@/shared/jobState/personJobState';
import type { BrandData, JobRow, OrderRow, PermitRow } from './brandData.types';
import { applyFacts, ballOnUs, daysSince, Tier, type TodayInput } from './todayModel';
import { isTestOrder, isVoidInStripe, num, orderName, orderRef, orderTotal, receivables, type Receivable } from '@/modules/finance/receivables';

const DAY = 86_400_000;
const ts = (iso?: string | null) => {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(n) ? n : null;
};
const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const jobName = (j: JobRow) =>
  displayPersonName(j.person?.first_name, j.person?.last_name) || j.person?.email || 'Unknown';

/** Sales lane: open enquired / quoted / invoiced jobs. */
export function salesItems(d: BrandData, now: number): TodayInput[] {
  const out: TodayInput[] = [];
  const orderByJob = new Map(d.orders.filter((o) => o.job_id).map((o) => [o.job_id!, o]));
  const enqByPerson = new Map<string, NonNullable<BrandData['enquiries']>[number][]>();
  for (const e of [...(d.enquiries ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))) if (e.person_id) (enqByPerson.get(e.person_id) ?? enqByPerson.set(e.person_id, []).get(e.person_id)!).push(e);
  for (const j of d.jobs) {
    if (j.exit_reason || j.person?.is_test || !['enquired', 'quoted', 'invoiced'].includes(j.stage ?? '')) continue;
    const c = j.conversation;
    const lastIn = c?.last_inbound_at ?? null;
    const lastOut = c?.last_outbound_at ?? null;
    const us = ballOnUs(lastIn, lastOut);
    const ageH = (now - (ts(j.created_at) ?? now)) / 3_600_000;
    const order = orderByJob.get(j.id);
    const inv = order ? d.invoices.find((i) => i.order_id === order.id && i.status !== 'paid' && i.status !== 'void') : undefined;
    const enqs = j.person_id ? enqByPerson.get(j.person_id) ?? [] : [];
    const quote = enqs.find((e) => e.details?.name);
    const quotePrice = quote?.details?.price != null && num(quote.details.price) > 0 ? num(quote.details.price) : null;
    const value = order ? orderTotal(order) : inv ? num(inv.amount) : quotePrice;
    const asked = quote ? [quote.details!.name, quote.details!.type, quote.details!.colour].filter(Boolean).join(' · ') + (quotePrice != null && !order && !inv ? ` · web price ${gbp(quotePrice)}` : '')
      : enqs[0]?.sub_type ? `Contact form: ${enqs[0].sub_type.replace(/-/g, ' ')}` : null;
    const sourceRaw = enqs.length ? (enqs[enqs.length - 1].channel === 'quote' ? 'Web quote form' : enqs[enqs.length - 1].channel === 'contact' ? 'Web contact form' : 'Website') : j.source === 'email' ? 'Email' : j.source === 'manual' ? 'Phone / manual' : null;
    const source = sourceRaw && !sourceRaw.includes('Source not recorded') ? sourceRaw : null;
    const base = {
      personId: j.person_id, conversationId: c?.id ?? null, asked, source,
      key: `job:${j.id}`, lane: 'Sales' as const, name: jobName(j), ref: order ? orderRef(order) : null, valueGbp: value,
      lastInAt: lastIn, lastOutAt: lastOut, sinceAt: j.created_at, staleable: true, orderId: order?.id ?? null, channel: c?.channel ?? null, subject: c?.subject ?? null, snippet: c?.last_message_preview ?? null, to: `/dashboard/inbox${c?.id ? `?conversation=${c.id}` : ''}`,
    };
    const outDays = daysSince(lastOut, now);
    const issue = c?.ai_category === 'complaint' || c?.ai_category === 'issue';
    if (issue) { out.push({ ...base, verb: 'FLAG', flagTo: 'Arin', colour: 'red', tier: Tier.IssueOrHardDate, why: 'Customer issue: goes to Arin, no draft', staleable: false }); continue; }
    if (j.stage === 'enquired') {
      if (!lastOut && ageH < 48) out.push({ ...base, verb: 'CALL', colour: 'red', tier: Tier.NewEnquiry, why: `New enquiry ${Math.floor(ageH)}h ago, not contacted` });
      else if (us && lastOut) out.push({ ...base, verb: 'QUOTE', colour: 'red', tier: Tier.WaitingOnUs, why: 'They replied: send the quote' });
      else if (us) out.push({ ...base, verb: 'REPLY', colour: 'red', tier: Tier.WaitingOnUs, why: 'Waiting for our first reply' });
      else if (!lastOut) out.push({ ...base, verb: 'CALL', colour: 'amber', tier: Tier.Waiting, why: 'Never contacted' });
      else if ((outDays ?? 0) >= 2) out.push({ ...base, verb: 'SOFT FUP', colour: 'amber', tier: Tier.Waiting, why: `No reply ${outDays}d after our message` });
      else out.push({ ...base, verb: 'WAIT', colour: 'blue', tier: Tier.OnHold, why: 'We wrote recently' });
    } else if (j.stage === 'quoted') {
      if (us) out.push({ ...base, verb: 'REPLY', colour: 'red', tier: Tier.WaitingOnUs, why: lastOut ? 'They replied to the quote' : 'Quoted, but nothing sent on this thread yet: reply' });
      else if ((outDays ?? 99) >= 7) out.push({ ...base, verb: 'CHASE', colour: 'amber', tier: Tier.QuietQuote, why: `Quote quiet ${outDays ?? '?'}d` });
      else out.push({ ...base, verb: 'WAIT', colour: 'blue', tier: Tier.OnHold, why: `Quote sent ${outDays}d ago` });
    } else {
      if (us) out.push({ ...base, verb: 'REPLY', colour: 'red', tier: Tier.WaitingOnUs, why: 'They replied about the invoice' });
      else if (inv && !isVoidInStripe(inv)) out.push({ ...base, verb: 'CHASE', colour: 'amber', tier: Tier.MoneyDue, why: `${inv.invoice_number} unpaid` });
      else if (!inv) out.push({ ...base, verb: 'INVOICE', colour: 'amber', tier: Tier.MoneyDue, why: 'Said yes, no live invoice' });
      else out.push({ ...base, verb: 'CHASE', colour: 'amber', tier: Tier.MoneyDue, why: `${inv.invoice_number} is void in Stripe: re-send or check payment` });
    }
  }
  return out.map((i) => applyFacts(i, now));
}

const OPEN_ORDER_STAGES = new Set(['confirmed', 'in_production', 'fixed']);
const isOpenOrder = (o: OrderRow) => !isTestOrder(o) && !o.job?.exit_reason && OPEN_ORDER_STAGES.has(o.job?.stage ?? '');

/** CS lane: confirmed orders — family waiting, fixing date ≤ 7d missing something. A ready proof is the Proofs lane. */
export function csItems(d: BrandData, now: number): TodayInput[] {
  const out: TodayInput[] = [];
  for (const o of d.orders) {
    if (!isOpenOrder(o)) continue;
    const convs = d.convs.filter((c) => c.order_id === o.id);
    const lastIn = convs.reduce<string | null>((m, c) => (c.last_inbound_at && (!m || c.last_inbound_at > m) ? c.last_inbound_at : m), null);
    const lastOut = convs.reduce<string | null>((m, c) => (c.last_outbound_at && (!m || c.last_outbound_at > m) ? c.last_outbound_at : m), null);
    const base = { lane: 'CS' as const, name: orderName(o), ref: orderRef(o), valueGbp: orderTotal(o), lastInAt: lastIn, lastOutAt: lastOut, sinceAt: o.created_at, orderId: o.id, personId: o.person_id, to: `/dashboard/orders?order=${o.id}` };
    const fixIn = o.installation_date ? Math.ceil(((ts(o.installation_date) ?? now) - now) / DAY) : null;
    if (convs.some((c) => c.ai_category === 'complaint' || c.ai_category === 'issue')) {
      out.push({ ...base, key: `cs-flag:${o.id}`, verb: 'FLAG', flagTo: 'Matthew', colour: 'red', tier: Tier.IssueOrHardDate, why: 'Customer issue: to Matthew, no draft' });
      continue;
    }
    if (fixIn != null && fixIn <= 7) {
      const missing = [o.stone_status !== 'In Stock' && 'stone', o.inscription_status !== 'confirmed' && o.inscription_status !== 'final' && 'wording'].filter(Boolean);
      out.push({ ...base, key: `cs-fix:${o.id}`, verb: 'CONFIRM', colour: 'red', tier: Tier.IssueOrHardDate,
        why: fixIn < 0 ? `Fixing date passed ${-fixIn}d ago` : `Fixing in ${fixIn}d${missing.length ? ` · missing ${missing.join(', ')}` : ''}` });
      continue;
    }
    if (ballOnUs(lastIn, lastOut) && (daysSince(lastIn, now) ?? 999) < 60) {
      out.push({ ...base, key: `cs-reply:${o.id}`, verb: 'REPLY', colour: 'red', tier: Tier.WaitingOnUs, why: 'Family waiting on us' });
      continue;
    }
    // Proof wording comes from Orders (stageShortLabel). Received / In progress / NA
    // are Drafting, so Today does not ask to send them.
  }
  return out.map((i) => applyFacts(i, now));
}

const PERMIT_VERB: Record<string, { verb: TodayInput['verb']; why: string } | undefined> = {
  match_form: { verb: 'Send form', why: 'Pick the cemetery form and send it' },
  review_send_customer: { verb: 'Send form', why: 'Form ready: send to the family' },
  validate_return: { verb: 'Acknowledge form', why: 'Family returned the form: check it' },
  review_send_cemetery: { verb: 'Submit & pay fee', why: 'Submit to the cemetery and pay the fee' },
  reply_cemetery: { verb: 'REPLY', why: 'Cemetery is waiting on us' },
};

/** Permits lane (Arin 14 Oct: permits appear ONLY as Today actions — no page). */
export function permitItems(d: BrandData, now: number): TodayInput[] {
  const out: TodayInput[] = [];
  const orders = new Map(d.orders.map((o) => [o.id, o]));
  for (const p of d.permits as PermitRow[]) {
    const o = orders.get(p.order_id);
    if (!o || isTestOrder(o) || o.job?.exit_reason || p.permit_phase === 'approved') continue;
    const base = { key: `permit:${p.id}`, lane: 'Permits' as const, name: orderName(o), ref: orderRef(o), valueGbp: orderTotal(o), sinceAt: p.stage_entered_at ?? p.sent_at, orderId: o.id, personId: o.person_id, blocksFixing: !!o.installation_date, to: `/dashboard/orders?order=${o.id}` };
    const fixIn = o.installation_date ? Math.ceil(((ts(o.installation_date) ?? now) - now) / DAY) : null;
    const hard = fixIn != null && fixIn <= 7;
    const ours = p.waiting_on && p.waiting_on !== 'customer' && p.waiting_on !== 'cemetery' && p.waiting_on !== 'none';
    const map = p.next_action ? PERMIT_VERB[p.next_action] : undefined;
    if (ours && map) {
      out.push({ ...base, verb: map.verb, colour: hard ? 'red' : 'amber', tier: hard ? Tier.IssueOrHardDate : Tier.WaitingOnUs, why: hard ? `${map.why} · fixing in ${fixIn}d` : map.why });
    } else if (p.waiting_on === 'customer' || p.waiting_on === 'cemetery') {
      const since = daysSince(p.waiting_on === 'customer' ? p.sent_at ?? p.stage_entered_at : p.submitted_at ?? p.stage_entered_at, now) ?? 0;
      const after = p.waiting_on === 'customer' ? 7 : 14;
      if (since >= after || hard)
        out.push({ ...base, verb: 'CHASE', colour: hard ? 'red' : 'amber', tier: hard ? Tier.IssueOrHardDate : Tier.Waiting, why: `Waiting on the ${p.waiting_on} ${since}d` });
    }
  }
  return out.map((i) => applyFacts(i, now));
}

/** Proofs lane: the same orders the Orders "Proof awaiting" count uses. */
export function proofItems(d: BrandData, now: number): TodayInput[] {
  const out: TodayInput[] = [];
  for (const o of d.orders) {
    if (isTestOrder(o) || !proofAwaiting(o.proof_status, o.job?.stage, o.job?.exit_reason)) continue;
    out.push({
      key: `proof:${o.id}`,
      lane: 'Proofs',
      name: orderName(o),
      ref: orderRef(o),
      valueGbp: orderTotal(o),
      sinceAt: o.created_at,
      orderId: o.id,
      personId: o.person_id,
      verb: 'Send proof',
      colour: 'amber',
      tier: Tier.WaitingOnUs,
      why: 'Proof not approved yet',
      to: `/dashboard/orders?order=${o.id}`,
    });
  }
  return out.map((i) => applyFacts(i, now));
}

/** Finance lane: one row per receivable that needs an action, plus one reconciliation FLAG. */
export function financeItems(d: BrandData, now: number, rec: Receivable[] = receivables(d, now)): TodayInput[] {
  const out: TodayInput[] = [];
  const personByOrder = new Map(d.orders.map((o) => [o.id, o.person_id]));
  for (const r of rec) {
    if (!r.action) continue;
    // No deposit and quiet 60d+: it's a stale pipeline job (Sales "Abandoned?" list), not money due today.
    if (!r.depositIn && (r.ageDays ?? 0) >= 60) continue;
    const verb: TodayInput['verb'] = r.action === 'Chase' ? 'CHASE' : r.action === 'Raise invoice' ? 'INVOICE' : r.action === 'Match' ? 'Match payment' : r.action;
    const hard = r.installationDate && (ts(r.installationDate)! - now) / DAY <= 7;
    out.push({
      key: `fin:${r.orderId}:${r.action}`, lane: 'Finance', orderId: r.orderId, name: r.name, ref: r.ref, verb, colour: r.colour === 'red' ? 'red' : 'amber',
      tier: hard ? Tier.IssueOrHardDate : Tier.MoneyDue, why: `${r.why} · ${gbp(r.remaining)} owed`, valueGbp: r.remaining,
      sinceAt: r.ageDays != null ? new Date(now - r.ageDays * DAY).toISOString() : null, personId: personByOrder.get(r.orderId) ?? null,
      to: r.openInvoice?.id
        ? `/dashboard/finance?invoice=${encodeURIComponent(r.openInvoice.id)}`
        : `/dashboard/finance?order=${encodeURIComponent(r.orderId)}`,
    });
  }
  for (const p of d.orderPayments) {
    if (p.status === 'matched') continue;
    out.push({ key: `match:${p.id}`, lane: 'Finance', name: p.reference || 'Unmatched payment', verb: 'Match payment', colour: 'red', tier: Tier.MoneyDue,
      why: `${gbp(num(p.amount))} ${p.source ?? ''} in, not linked to an order`, valueGbp: num(p.amount), sinceAt: p.received_at, to: '/dashboard/finance?tab=reconcile' });
  }
  const voided = d.invoices.filter((i) => isVoidInStripe(i) && num(i.amount) >= 5);
  if (voided.length) {
    const total = voided.reduce((s, i) => s + num(i.amount), 0);
    out.push({ key: 'fin:void-in-stripe', lane: 'Finance', name: `${voided.length} invoices void in Stripe`, verb: 'FLAG', flagTo: 'Arin', colour: 'amber', tier: Tier.MoneyDue,
      why: `Pending in Mason but void in Stripe (${gbp(total)}): mark paid or void`, valueGbp: Math.round(total * 100) / 100,
      sinceAt: voided.map((i) => i.issue_date ?? i.created_at).sort()[0], to: '/dashboard/finance?tab=reconcile' });
  }
  return out.map((i) => applyFacts(i, now));
}

/** Payment chase from yes/no status. No amounts and no pound sign. */
export function statusChaseItems(d: BrandData, now: number): TodayInput[] {
  const out: TodayInput[] = [];
  for (const o of d.orders) {
    const status = o.paymentStatus;
    if (!status || status.fully_paid || !status.balance_outstanding) continue;
    const deposit = !status.deposit_received;
    out.push({
      key: `fin-status:${o.id}`, lane: 'Finance', orderId: o.id, name: orderName(o), ref: orderRef(o),
      verb: 'CHASE', colour: 'amber', tier: Tier.MoneyDue,
      why: deposit ? 'Deposit not received' : 'Balance outstanding', valueGbp: null,
      sinceAt: o.created_at, personId: o.person_id, to: `/dashboard/orders?order=${o.id}`,
    });
  }
  return out.map((i) => applyFacts(i, now));
}

function withoutAmounts(items: TodayInput[]): TodayInput[] {
  return items.map((item) => ({
    ...item,
    valueGbp: null,
    asked: item.asked?.replace(/\s*· web price £[\d,.]+/g, '') ?? item.asked,
  }));
}

export function allTodayInputs(d: BrandData, now: number, canSeeMoney: boolean): TodayInput[] {
  const work = [...salesItems(d, now), ...csItems(d, now), ...permitItems(d, now), ...proofItems(d, now)];
  if (canSeeMoney) return [...work, ...financeItems(d, now)];
  return [...withoutAmounts(work), ...statusChaseItems(d, now)];
}
