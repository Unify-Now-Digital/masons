/**
 * Customers (post-sale) priority: which confirmed orders need us first.
 * Pure + unit-tested. Read-only inputs: orders (fixing / promised dates, permit,
 * proof, payments) and the inbox "ball" (who wrote last) per person.
 *
 * Order of urgency (Arin, 14 Oct 2026):
 *   1. hard deadline soon (fixing within 7 days)
 *   2. promised date passed, or the customer chased (wrote last, waiting on us)
 *   3. money due (balance on/after fixing, deposit unrecorded)
 *   4. permit / proof blocked on us
 *   5. longest waiting
 *   on hold last.
 */
import { formatPhoneDisplay } from '@/modules/inbox/utils/contactTitle';
import type { NextActionKind, NextActionTone } from '@/shared/lib/nextAction';
import { tidyStoredName } from '@/shared/lib/personName';
import type { ActionColour } from '@/shared/nextAction';
import { LANE_LIST_CAP } from './caps';

const DAY = 86_400_000;
/** Customer Service list length. Same cap as Today and Inbox Priority. */
export const PRIORITY_CAP = LANE_LIST_CAP.CS;

export interface PriorityOrderLike {
  id: string;
  person_id: string | null;
  person_name?: string | null;
  customer_name?: string | null;
  value?: number | null;
  permit_cost?: number | null;
  invoice?: { amount?: number | string | null; amount_paid?: number | string | null } | null;
  permit_status?: string | null;
  proof_status?: string | null;
  deposit_date?: string | null;
  second_payment_date?: string | null;
  due_date?: string | null;
  installation_date?: string | null;
  notes?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

/** sinceMs = elapsed ms since the last message (inboxBuckets aging.ball), not a timestamp. */
export interface Ball { side: 'us' | 'them'; sinceMs: number }

export interface PriorityItem {
  key: string;
  personId: string;
  name: string;
  value: number | null;
  stage: string;
  action: { kind: Exclude<NextActionKind, 'none'>; label: string; tone: NextActionTone; colour: ActionColour };
  why: string;
  /** ISO of the moment the row became "waiting" (for the age column). */
  since: string | null;
  tier: number;
  urgency: number;
}

const num = (v: unknown) => { const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) ? n : null; };
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const daysTo = (iso: string | null | undefined, now: Date) => { if (!iso) return null; const t = Date.parse(iso); return Number.isNaN(t) ? null : Math.floor((t - now.getTime()) / DAY); };
const ago = (d: number) => (d < 1 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`);
const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export function orderStage(o: PriorityOrderLike): string {
  if (o.installation_date && Date.parse(o.installation_date) <= Date.now()) return 'Fixed';
  if (o.installation_date) return 'Fixing booked';
  if (o.permit_status && o.permit_status !== 'approved' && o.permit_status !== 'not_started') return 'Permit';
  if (o.proof_status && ['Sent', 'Revision', 'Received'].includes(o.proof_status)) return 'Proof';
  if (!o.deposit_date) return 'Order confirmed';
  return 'In production';
}

export function customerPriorityItem(o: PriorityOrderLike, ball: Ball | null, now: Date = new Date()): PriorityItem | null {
  if (!o.person_id) return null;
  const name = formatPhoneDisplay(tidyStoredName(o.person_name || o.customer_name) || 'Customer');
  const total = num(o.invoice?.amount) ?? ((num(o.value) ?? 0) + (num(o.permit_cost) ?? 0) || null);
  const paid = num(o.invoice?.amount_paid) ?? 0;
  const fixIn = daysTo(o.installation_date, now);
  const dueIn = daysTo(o.due_date, now);
  const onHold = /\bon[\s-]?hold\b/i.test(o.notes ?? '');
  const chasedDays = ball?.side === 'us' ? Math.floor(ball.sinceMs / DAY) : null;
  const base = { key: `order:${o.id}`, personId: o.person_id, name, value: total, stage: orderStage(o) };
  const mk = (tier: number, urgency: number, kind: PriorityItem['action']['kind'], label: string, colour: ActionColour, why: string, since: string | null): PriorityItem => ({
    ...base, tier, urgency, why, since,
    action: { kind, label, colour, tone: colour === 'red' ? 'red' : colour === 'amber' ? 'amber' : 'neutral' },
  });
  const updated = o.updated_at ?? o.created_at ?? null;

  if (onHold) return mk(9, -(daysTo(updated, now) ?? 0), 'waiting', 'Waiting', 'blue', 'On hold', updated);
  if (fixIn != null && fixIn >= 0 && fixIn <= 7) return mk(1, fixIn, 'follow', 'Call', 'red', `Fixing ${fmtDate(o.installation_date!)} · confirm access`, o.installation_date!);
  if (chasedDays != null) return mk(2, -chasedDays, 'follow', chasedDays >= 3 ? 'Call' : 'Reply', 'red', `Wrote ${ago(chasedDays)}, waiting on us`, new Date(now.getTime() - ball!.sinceMs).toISOString());
  if (dueIn != null && dueIn < 0 && !(fixIn != null && fixIn < 0)) return mk(2, dueIn, 'follow', 'Call', 'red', `Promised ${fmtDate(o.due_date!)}, date passed`, o.due_date!);
  if (fixIn != null && fixIn < 0 && !o.second_payment_date) {
    const bal = total != null ? Math.max(0, total - paid) : null;
    return mk(3, fixIn, 'balance', 'Request balance', 'amber', `Fixed ${ago(-fixIn)} · balance${bal ? ' ' + gbp(bal) : ''} due`, o.installation_date!);
  }
  if (!o.deposit_date && paid > 0) return mk(3, 0, 'deposit', 'Record payment', 'amber', `${gbp(paid)} received, deposit not recorded`, updated);
  if (!o.deposit_date) return mk(3, -(daysTo(o.created_at, now) ?? 0), 'deposit', 'Request deposit', 'amber', 'Order confirmed, no deposit yet', o.created_at ?? null);
  if (o.permit_status === 'customer_completed') return mk(4, 0, 'follow', 'Chase', 'amber', 'Permit form back from family · submit it', updated);
  if (o.proof_status === 'Revision') return mk(4, 0, 'follow', 'Reply', 'amber', 'Proof changes requested', updated);
  if (fixIn != null && fixIn > 7 && fixIn <= 21 && !o.second_payment_date) return mk(5, fixIn, 'balance', 'Request balance', 'amber', `Fixing ${fmtDate(o.installation_date!)} · balance due on fixing`, o.installation_date!);
  const waitWhy = o.permit_status === 'pending' || o.permit_status === 'form_sent' ? 'Permit with cemetery / family'
    : o.proof_status === 'Sent' ? 'Proof sent, waiting on family' : 'In production';
  const ballThem = ball?.side === 'them' ? new Date(now.getTime() - ball.sinceMs).toISOString() : updated;
  return mk(6, -(now.getTime() - Date.parse(ballThem ?? now.toISOString())) / DAY, 'waiting', 'Waiting', 'blue', waitWhy, ballThem);
}

/** Rank: tier (deadline → chased/promised → money → blocked → waiting → hold), then urgency. */
export function customerPriorityList(items: PriorityItem[], cap: number = PRIORITY_CAP): PriorityItem[] {
  const best = new Map<string, PriorityItem>();
  for (const it of items) {
    const cur = best.get(it.personId);
    if (!cur || it.tier < cur.tier || (it.tier === cur.tier && it.urgency < cur.urgency)) best.set(it.personId, it);
  }
  return [...best.values()].sort((a, b) => a.tier - b.tier || a.urgency - b.urgency).slice(0, cap);
}

export type ReplyPriceKind = 'quote' | 'order' | 'invoice' | 'guide' | 'guess';

/** Plain prepared reply for the composer. Never sent automatically. */
export function preparedReply(firstName: string, label: string, why: string, value: number | null, priceKind?: ReplyPriceKind | null): string {
  const hi = firstName ? `Hi ${firstName},\n\n` : 'Hi,\n\n';
  const end = '\n\nKind regards,';
  if (label === 'Request balance') return `${hi}Just a quick note about the memorial: the remaining balance${value ? ` on the ${gbp(value)} order` : ''} is now due. I can send the payment link over whenever suits.${end}`;
  if (label === 'Request deposit') return `${hi}Thank you again for going ahead. To get the memorial into production we just need the deposit; I can send the payment link over today.${end}`;
  if (label === 'Call' && /Fixing/.test(why)) return `${hi}We're all set to fix the memorial ${why.replace(/^Fixing /, '').replace(/ · .*/, '')}. Could you confirm there's clear access to the grave on the day?${end}`;
  if (label === 'Chase' && /Permit/.test(why)) return `${hi}Thank you for returning the permit form. I'm submitting it to the cemetery now and will let you know as soon as it's approved.${end}`;
  if (priceKind === 'guide' || priceKind === 'guess') {
    return `${hi}Thank you for the details on the form. The guide price${value ? ` (${gbp(value)})` : ''} is not a quote yet. I'll check the cemetery and the design, and send a quote when it's ready.${end}`;
  }
  const sentQuote = priceKind === 'quote' || (priceKind == null && (label === 'Gentle follow-up' || /\bquote sent\b|\breplied to the quote\b|\bquote quiet\b/i.test(why)));
  if (sentQuote && priceKind !== 'order' && priceKind !== 'invoice') return `${hi}I just wanted to check whether you had any questions about the quote${value ? ` (${gbp(value)})` : ''}, or if you'd like any changes to the design. Happy to help whenever you're ready.${end}`;
  if (label === 'Make first contact') return `${hi}Thank you for getting in touch about a memorial. I'd be glad to help; could you tell me which cemetery it's for and the style you have in mind, and I'll put a quote together.${end}`;
  if (label === 'Send quote') return `${hi}Thank you for your enquiry. I'll put a quote together for you; could you confirm the cemetery and the style you have in mind?${end}`;
  return `${hi}Thank you for your message, and sorry for the wait. I'll come back to you with the details shortly.${end}`;
}
