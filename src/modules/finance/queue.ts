/**
 * One finance queue. Rows come only from data the page already loads (BrandData):
 * receivables, order payments, invoice payments, and the existing reconciliation flags.
 */
import type { BrandData, OrderPaymentRow } from '@/modules/today/brandData.types';
import { gbp2 } from '@/modules/today/uiHelpers';
import {
  isTestInvoice,
  isVoidInStripe,
  normSource,
  num,
  orderName,
  orderRef,
  paymentEvents,
  receivables,
  reconciliationFlags,
  type Receivable,
  type Source,
} from './receivables';

const DAY = 86_400_000;
const SRC: Record<Source, string> = { revolut: 'Revolut', stripe: 'Stripe', bank: 'Bank', other: 'Other' };

export const QUEUE_FILTERS = [
  { id: 'needs', label: 'Needs action' },
  { id: 'unmatched', label: 'Unmatched' },
  { id: 'outstanding', label: 'Outstanding' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid/Successful' },
  { id: 'void', label: 'Void' },
  { id: 'all', label: 'All' },
] as const;

export type QueueFilter = (typeof QUEUE_FILTERS)[number]['id'];
export type QueueChip = 'Match' | 'Chase' | 'Record' | 'Fix' | 'Send' | 'Done';
export type QueueButton = 'Record payment' | 'Match' | 'Send reminder' | 'Open';

export interface FinanceQueueRow {
  id: string;
  chip: QueueChip;
  colour: 'red' | 'amber' | 'green' | 'blue';
  name: string;
  ref: string | null;
  what: string;
  amount: number;
  ageLabel: string;
  overdue: boolean;
  button: QueueButton;
  orderId: string | null;
  /** Raw order_payments id, for the existing match dialog. */
  paymentId: string | null;
  invoiceId: string | null;
  /** Every filter this row belongs to, except All (All is the full list). */
  filters: Exclude<QueueFilter, 'all'>[];
}

function ts(iso?: string | null): number | null {
  if (!iso) return null;
  const n = Date.parse(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isFinite(n) ? n : null;
}

function daysBetween(from: number | null, now: number): number | null {
  if (from == null) return null;
  return Math.max(0, Math.floor((now - from) / DAY));
}

function ageLabel(days: number | null, overdue: boolean): string {
  if (days == null) return '—';
  if (overdue) return days === 0 ? 'due today' : `${days}d overdue`;
  if (days === 0) return 'today';
  return `${days}d`;
}

function sourceOf(raw: string | null | undefined): Source {
  return normSource(raw);
}

function isOpenUnmatched(p: OrderPaymentRow): boolean {
  if (p.status === 'matched' || p.status === 'dismissed' || p.status === 'pass_through') return false;
  return p.status === 'unmatched' || !p.order_id;
}

function overdueOf(r: Receivable, now: number): { overdue: boolean; days: number | null } {
  const marks: number[] = [];
  if (r.remaining > 1) {
    const fix = ts(r.installationDate);
    if (fix != null && fix < now) marks.push(fix);
    const due = ts(r.openInvoice?.due_date);
    if (due != null && due < now) marks.push(due);
  }
  if (!marks.length) return { overdue: false, days: r.ageDays };
  const days = daysBetween(Math.min(...marks), now);
  return { overdue: true, days };
}

function balanceWhat(r: Receivable): string {
  if (r.depositIn && r.paid === 0 && r.action === 'Record payment') return 'deposit marked, no amount';
  if (!r.depositSettled && r.remaining > 1) {
    return r.openInvoice ? 'deposit due' : r.action === 'Raise invoice' ? 'no invoice yet' : 'deposit due';
  }
  if (r.action === 'Chase') return 'invoice unpaid';
  if (r.action === 'Raise invoice') return 'no invoice yet';
  if (r.action === 'Match') return 'payment to match';
  if (r.action === 'Request balance') return 'balance due';
  return 'balance due';
}

function balanceChip(r: Receivable): { chip: QueueChip; button: QueueButton; colour: FinanceQueueRow['colour'] } {
  if (r.action === 'Record payment') return { chip: 'Record', button: 'Record payment', colour: 'amber' };
  if (r.action === 'Chase') return { chip: 'Chase', button: 'Send reminder', colour: r.colour === 'red' ? 'red' : 'amber' };
  if (r.action === 'Match') return { chip: 'Match', button: 'Match', colour: 'amber' };
  if (r.action === 'Raise invoice' || r.action === 'Request balance') return { chip: 'Send', button: 'Open', colour: 'amber' };
  return { chip: 'Send', button: 'Open', colour: r.colour === 'red' ? 'red' : 'blue' };
}

function orderForPayment(d: BrandData, orderId: string | null) {
  if (!orderId) return null;
  return d.orders.find((o) => o.id === orderId) ?? null;
}

function rank(rows: FinanceQueueRow[]): FinanceQueueRow[] {
  return [...rows].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (b.amount !== a.amount) return b.amount - a.amount;
    return a.name.localeCompare(b.name, 'en-GB');
  });
}

export function buildFinanceQueue(d: BrandData, now: number): FinanceQueueRow[] {
  const rows: FinanceQueueRow[] = [];
  const paidOrderIds = new Set<string>();

  for (const e of paymentEvents(d)) {
    if (e.matched && e.orderId) paidOrderIds.add(e.orderId);
    if (e.id.startsWith('ip:') && !e.orderId && (e.source === 'stripe' || e.source === 'revolut')) {
      const inv = e.invoiceId ? d.invoices.find((i) => i.id === e.invoiceId) : undefined;
      rows.push({
        id: `unmatched:${e.id}`,
        chip: 'Match',
        colour: 'red',
        name: inv?.customer_name?.trim() || 'Unmatched payment',
        ref: inv?.invoice_number ?? null,
        what: `${SRC[e.source]} ${gbp2(e.amount)} · no order`,
        amount: e.amount,
        ageLabel: ageLabel(daysBetween(ts(e.at), now), false),
        overdue: false,
        button: 'Match',
        orderId: null,
        paymentId: null,
        invoiceId: e.invoiceId,
        filters: ['needs', 'unmatched'],
      });
    } else if (e.matched && e.orderId) {
      const o = orderForPayment(d, e.orderId);
      rows.push({
        id: `paid:${e.id}`,
        chip: 'Done',
        colour: 'green',
        name: o ? orderName(o) : 'Payment',
        ref: o ? orderRef(o) : null,
        what: `${SRC[e.source]} ${gbp2(e.amount)} · ${e.type ?? 'payment'}`,
        amount: e.amount,
        ageLabel: ageLabel(daysBetween(ts(e.at), now), false),
        overdue: false,
        button: 'Open',
        orderId: e.orderId,
        paymentId: null,
        invoiceId: e.invoiceId,
        filters: ['paid'],
      });
    }
  }

  for (const p of d.orderPayments) {
    if (!isOpenUnmatched(p)) continue;
    const source = sourceOf(p.source);
    const amount = num(p.amount);
    const o = orderForPayment(d, p.order_id);
    const noOrder = !p.order_id;
    const needs = noOrder && (source === 'revolut' || source === 'stripe');
    const filters: FinanceQueueRow['filters'] = ['unmatched'];
    if (needs || !noOrder) filters.unshift('needs');
    rows.push({
      id: `unmatched:op:${p.id}`,
      chip: 'Match',
      colour: 'red',
      name: o ? orderName(o) : (p.reference?.trim() || 'Unmatched payment'),
      ref: o ? orderRef(o) : null,
      what: `${SRC[source]} ${gbp2(amount)} · ${noOrder ? 'no order' : 'not matched'}`,
      amount,
      ageLabel: ageLabel(daysBetween(ts(p.received_at), now), false),
      overdue: false,
      button: 'Match',
      orderId: p.order_id,
      paymentId: p.id,
      invoiceId: null,
      filters,
    });
  }

  for (const r of receivables(d, now)) {
    if (r.remaining <= 1) {
      if (!paidOrderIds.has(r.orderId)) {
        rows.push({
          id: `paid:order:${r.orderId}`,
          chip: 'Done',
          colour: 'green',
          name: r.name,
          ref: r.ref,
          what: 'Paid in full',
          amount: r.total,
          ageLabel: ageLabel(r.ageDays, false),
          overdue: false,
          button: 'Open',
          orderId: r.orderId,
          paymentId: null,
          invoiceId: r.openInvoice?.id ?? null,
          filters: ['paid'],
        });
      }
      continue;
    }
    const late = overdueOf(r, now);
    const tone = balanceChip(r);
    const filters: FinanceQueueRow['filters'] = ['needs', 'outstanding'];
    if (late.overdue) filters.push('overdue');
    rows.push({
      id: `bal:${r.orderId}`,
      chip: late.overdue && tone.chip === 'Send' ? 'Chase' : tone.chip,
      colour: late.overdue ? 'red' : tone.colour,
      name: r.name,
      ref: r.ref,
      what: r.moneyNote && balanceWhat(r) === 'deposit due' ? `deposit due · ${r.moneyNote}` : balanceWhat(r),
      amount: !r.depositSettled && r.remaining > 1 ? r.depositDue : r.remaining,
      ageLabel: ageLabel(late.days, late.overdue),
      overdue: late.overdue,
      button: late.overdue && r.action === 'Chase' ? 'Send reminder' : tone.button,
      orderId: r.orderId,
      paymentId: null,
      invoiceId: r.openInvoice?.id ?? null,
      filters,
    });
  }

  for (const i of d.invoices) {
    if (!isVoidInStripe(i) || isTestInvoice(i)) continue;
    const o = orderForPayment(d, i.order_id);
    rows.push({
      id: `void:${i.id}`,
      chip: 'Fix',
      colour: 'amber',
      name: o ? orderName(o) : (i.customer_name?.trim() || 'Invoice'),
      ref: i.invoice_number,
      what: 'Void in Stripe',
      amount: num(i.amount),
      ageLabel: ageLabel(daysBetween(ts(i.issue_date ?? i.created_at), now), false),
      overdue: false,
      button: 'Open',
      orderId: i.order_id,
      paymentId: null,
      invoiceId: i.id,
      filters: ['void'],
    });
  }

  for (const flag of reconciliationFlags(d)) {
    if (flag.kind === 'Void in Stripe, pending in Mason') continue;
    const inv = d.invoices.find((i) => i.invoice_number != null && flag.ref.includes(i.invoice_number));
    const orderFromRef = /#(\d+)/.exec(flag.ref);
    const o = orderFromRef
      ? d.orders.find((x) => String(x.order_number) === orderFromRef[1])
      : inv?.order_id ? orderForPayment(d, inv.order_id) : null;
    rows.push({
      id: `fix:${flag.kind}:${flag.ref}`,
      chip: 'Fix',
      colour: 'amber',
      name: flag.name,
      ref: flag.ref,
      what: flag.kind,
      amount: Math.abs(flag.amount),
      ageLabel: ageLabel(daysBetween(ts(o?.created_at ?? inv?.issue_date ?? inv?.created_at), now), false),
      overdue: false,
      button: 'Open',
      orderId: o?.id ?? inv?.order_id ?? null,
      paymentId: null,
      invoiceId: inv?.id ?? null,
      filters: ['needs'],
    });
  }

  return rank(rows);
}

export function rowsForFilter(rows: FinanceQueueRow[], filter: QueueFilter): FinanceQueueRow[] {
  if (filter === 'all') return rows;
  return rows.filter((row) => row.filters.includes(filter));
}

export function queueCounts(rows: FinanceQueueRow[]): Record<QueueFilter, number> {
  const counts: Record<QueueFilter, number> = {
    needs: 0, unmatched: 0, outstanding: 0, overdue: 0, paid: 0, void: 0, all: rows.length,
  };
  for (const row of rows) {
    for (const filter of row.filters) counts[filter] += 1;
  }
  return counts;
}
