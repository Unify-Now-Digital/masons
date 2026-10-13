/**
 * Pure view models for Finance (finance-v1), Hub (hub-v1) and the install planner
 * (mapping-v1). Real data only: inputs are existing invoices / orders / payments /
 * jobs rows; anything not stored is reported as missing, never estimated.
 */
import { nextActionForOrder, type NextAction } from '@/shared/lib/nextAction';

const DAY = 86_400_000;

/* ───────────── Finance ───────────── */

export interface OwedInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string | null;
  customer: string;
  /** ISO issue date — age is measured from here. */
  issueDate: string | null;
  remainingPence: number;
  status: string;
}

export type AgeBucket = 'd90' | 'd31to90' | 'd8to30' | 'd0to7';
export const AGE_BUCKET_LABEL: Record<AgeBucket, string> = {
  d90: '90+ days',
  d31to90: '31–90 days',
  d8to30: '8–30 days',
  d0to7: '0–7 days',
};

export const ageDays = (iso: string | null, now: Date) =>
  iso ? Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY)) : null;

export function ageBucket(days: number): AgeBucket {
  return days > 90 ? 'd90' : days > 30 ? 'd31to90' : days > 7 ? 'd8to30' : 'd0to7';
}

/** Only invoices that still owe money (void / paid excluded). */
export const isOwed = (i: OwedInvoice) => i.remainingPence > 0 && i.status !== 'void' && i.status !== 'paid';

export function agedOwed(invoices: OwedInvoice[], now: Date = new Date()): Record<AgeBucket, number> {
  const out: Record<AgeBucket, number> = { d90: 0, d31to90: 0, d8to30: 0, d0to7: 0 };
  for (const i of invoices) {
    if (!isOwed(i)) continue;
    out[ageBucket(ageDays(i.issueDate, now) ?? 0)] += i.remainingPence / 100;
  }
  for (const k of Object.keys(out) as AgeBucket[]) out[k] = Math.round(out[k] * 100) / 100;
  return out;
}

/** Chase queue: owed invoices, oldest first. */
export function chaseQueue(invoices: OwedInvoice[], now: Date = new Date()) {
  return invoices
    .filter(isOwed)
    .map((i) => ({ ...i, days: ageDays(i.issueDate, now) }))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
}

export interface PaymentLike {
  amount: number; // pounds
  at: string | null;
}

/** Monday 00:00 (local) of the week containing d. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

/** Collected per week for the last `weeks` weeks (oldest first, current week last). */
export function cashByWeek(payments: PaymentLike[], weeks: number, now: Date = new Date()) {
  const current = weekStart(now);
  const starts = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(current);
    d.setDate(d.getDate() - 7 * (weeks - 1 - i));
    return d;
  });
  const totals = starts.map(() => 0);
  for (const p of payments) {
    if (!p.at) continue;
    const t = new Date(p.at).getTime();
    for (let i = starts.length - 1; i >= 0; i--) {
      if (t >= starts[i]!.getTime()) {
        const end = starts[i]!.getTime() + 7 * DAY;
        if (t < end) totals[i] += p.amount;
        break;
      }
    }
  }
  return starts.map((s, i) => ({ weekStart: s, collected: Math.round(totals[i]! * 100) / 100, current: i === starts.length - 1 }));
}

/** CSV for the accountant (RFC 4180 quoting). */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

/* ───────────── Orders as money / installs ───────────── */

export interface SectionOrder {
  id: string;
  ref: string;
  customer: string;
  forName: string | null;
  location: string | null;
  jobStage: string | null;
  jobPaidAt: string | null;
  jobExitReason: string | null;
  depositDate: string | null;
  secondPaymentDate: string | null;
  stoneStatus: string | null;
  permitStatus: string | null;
  proofStatus: string | null;
  installationDate: string | null;
  total: number;
  amountPaid: number | null;
  hasInvoice: boolean;
}

export const orderAction = (o: SectionOrder, now: Date = new Date()): NextAction =>
  nextActionForOrder(
    {
      jobStage: o.jobStage,
      jobExitReason: o.jobExitReason,
      jobPaidAt: o.jobPaidAt,
      depositDate: o.depositDate,
      secondPaymentDate: o.secondPaymentDate,
      stoneStatus: o.stoneStatus,
      permitStatus: o.permitStatus,
      proofStatus: o.proofStatus,
      installationDate: o.installationDate,
    },
    now,
  );

const isOpen = (o: SectionOrder) => !o.jobExitReason && o.jobStage !== 'complete';
const depositIn = (o: SectionOrder) => !!o.jobPaidAt || !!o.depositDate || (o.amountPaid ?? 0) > 0;
const AFTER_PAID = new Set(['confirmed', 'in_production', 'fixed']);

/** Confirmed+ orders with no payment recorded and no invoice → Request deposit. */
export function noPaymentOrders(orders: SectionOrder[]) {
  return orders.filter((o) => isOpen(o) && AFTER_PAID.has(o.jobStage ?? '') && !depositIn(o) && !o.hasInvoice);
}

/** Balance due on completion: deposit in, no second payment, balance known from the invoice. */
export function dueOnCompletion(orders: SectionOrder[]) {
  return orders
    .filter((o) => isOpen(o) && depositIn(o) && !o.secondPaymentDate)
    .map((o) => ({ ...o, balance: o.amountPaid != null && o.total > 0 ? Math.max(0, Math.round((o.total - o.amountPaid) * 100) / 100) : null }));
}

export const isInstallReady = (o: SectionOrder) =>
  o.stoneStatus === 'In Stock' &&
  o.permitStatus === 'approved' &&
  ['Approved', 'Lettered', 'NA'].includes(o.proofStatus ?? '');

/** Install planner tray: ready and unbooked; split by whether the deposit is in. */
export function installTray(orders: SectionOrder[]) {
  const ready = orders.filter((o) => isOpen(o) && isInstallReady(o) && !o.installationDate);
  return {
    ready: ready.filter(depositIn),
    blocked: ready.filter((o) => !depositIn(o)),
  };
}

/** Bookings per weekday (Mon–Fri) for the week starting `monday`. */
export function weekBoard(orders: SectionOrder[], monday: Date) {
  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + i);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    return { day, bookings: orders.filter((o) => isOpen(o) && (o.installationDate ?? '').slice(0, 10) === key) };
  });
}

/* ───────────── Hub ───────────── */

export interface WeekCompare {
  thisWeek: number;
  lastWeek: number;
}

export function countThisVsLast(dates: (string | null)[], now: Date = new Date()): WeekCompare {
  const ws = weekStart(now).getTime();
  const lws = ws - 7 * DAY;
  let thisWeek = 0, lastWeek = 0;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (t >= ws && t <= now.getTime()) thisWeek++;
    else if (t >= lws && t < ws) lastWeek++;
  }
  return { thisWeek, lastWeek };
}

export function sumThisVsLast(payments: PaymentLike[], now: Date = new Date()): WeekCompare {
  const ws = weekStart(now).getTime();
  const lws = ws - 7 * DAY;
  let thisWeek = 0, lastWeek = 0;
  for (const p of payments) {
    if (!p.at) continue;
    const t = new Date(p.at).getTime();
    if (t >= ws && t <= now.getTime()) thisWeek += p.amount;
    else if (t >= lws && t < ws) lastWeek += p.amount;
  }
  return { thisWeek: Math.round(thisWeek * 100) / 100, lastWeek: Math.round(lastWeek * 100) / 100 };
}

export interface TodoItem {
  key: string;
  section: 'Orders' | 'Pipeline' | 'Finance' | 'Map';
  name: string;
  why: string;
  action: NextAction;
  to: string;
  /** Higher = sooner. Blocked/overdue first, then money unlocked, then age. */
  rank: number;
}

/** "N to do first": the top `n` items across sections (each section supplies its candidates). */
export function topTodos(items: TodoItem[], n = 3): TodoItem[] {
  return [...items].sort((a, b) => b.rank - a.rank).slice(0, n);
}
