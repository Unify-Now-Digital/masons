/**
 * Pure view models for Finance (finance-v1), Hub (hub-v1) and the install planner
 * (mapping-v1). Real data only: inputs are existing invoices / orders / payments /
 * jobs rows; anything not stored is reported as missing, never estimated.
 */
import { nextActionForOrder, type NextAction } from '@/shared/lib/nextAction';
import { londonDayKey, londonWeekStart } from '@/shared/utils/londonTime';

const DAY = 86_400_000;

/* ───────────── Finance ───────────── */

export interface OwedInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string | null;
  customer: string;
  /** ISO issue date — age is measured from here. */
  issueDate: string | null;
  /** ISO due date; null/placeholder when not reliable. */
  dueDate?: string | null;
  remainingPence: number;
  status: string;
}

export type AgeBucket = 'd90' | 'd31to90' | 'd8to30' | 'd0to7' | 'noDate';
export const AGE_BUCKET_LABEL: Record<AgeBucket, string> = {
  d90: '90+ days',
  d31to90: '31–89 days',
  d8to30: '8–30 days',
  d0to7: '0–7 days',
  noDate: 'no issue date',
};

/** "14 Oct" — shared short date for the sections pages. */
export const shortDayMonth = (d: Date | string) =>
  (typeof d === 'string' ? localDay(d) : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * Calendar day for a date-only ('YYYY-MM-DD') or timestamp value. Timestamps are read on the
 * Europe/London calendar (business time), whatever the device zone; the result is a local
 * Date at midnight of that calendar day, so day arithmetic stays simple.
 */
export function localDay(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return d;
  const [y, mo, da] = londonDayKey(d).split('-').map(Number);
  return new Date(y!, mo! - 1, da!);
}
const dayIndex = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
/** YYYY-MM-DD in local time. */
export const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Whole local calendar days since `iso` (no UTC/BST drift). */
export const ageDays = (iso: string | null, now: Date) => {
  if (!iso) return null;
  const d = localDay(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, dayIndex(now) - dayIndex(d));
};

export function ageBucket(days: number | null): AgeBucket {
  if (days == null) return 'noDate';
  return days >= 90 ? 'd90' : days > 30 ? 'd31to90' : days > 7 ? 'd8to30' : 'd0to7';
}

/** Due date usable for chasing (placeholder 2100+ dates ignored). */
const reliableDue = (iso: string | null | undefined) => (iso && iso.slice(0, 10) < '2100-01-01' ? iso.slice(0, 10) : null);

/** Only invoices that still owe money (void / paid excluded). */
export const isOwed = (i: OwedInvoice) => i.remainingPence > 0 && i.status !== 'void' && i.status !== 'paid';

export function agedOwed(invoices: OwedInvoice[], now: Date = new Date()): Record<AgeBucket, number> {
  const out: Record<AgeBucket, number> = { d90: 0, d31to90: 0, d8to30: 0, d0to7: 0, noDate: 0 };
  for (const i of invoices) {
    if (!isOwed(i)) continue;
    out[ageBucket(ageDays(i.issueDate, now))] += i.remainingPence / 100;
  }
  for (const k of Object.keys(out) as AgeBucket[]) out[k] = Math.round(out[k] * 100) / 100;
  return out;
}

/**
 * Chase queue: owed invoices that are past their due date (or have no reliable due
 * date), most overdue first. Invoices not yet due go to `notDue`, soonest first.
 */
export function chaseQueue(invoices: OwedInvoice[], now: Date = new Date()) {
  const today = localKey(now);
  const rows = invoices.filter(isOwed).map((i) => {
    const due = reliableDue(i.dueDate);
    return { ...i, days: ageDays(i.issueDate, now), due, overdueDays: due && due < today ? ageDays(due, now) : null };
  });
  const notDue = rows.filter((r) => r.due && r.due >= today).sort((a, b) => a.due!.localeCompare(b.due!));
  const chase = rows
    .filter((r) => !(r.due && r.due >= today))
    .sort((a, b) => {
      // Overdue (by due date) first, most overdue first; then no-due-date by issue age.
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return (b.days ?? -1) - (a.days ?? -1);
    });
  return Object.assign(chase, { notDue });
}

export interface PaymentLike {
  amount: number; // pounds
  at: string | null;
  /** Stable id for de-duplication across sources, e.g. a Stripe payment intent / charge id. */
  ids?: (string | null | undefined)[];
}

/**
 * Merge payment sources, counting each real payment once. A Stripe invoice payment
 * that was also matched as an order payment shares its payment-intent / charge id.
 */
export function dedupePayments(sources: PaymentLike[][]): PaymentLike[] {
  const seen = new Set<string>();
  const out: PaymentLike[] = [];
  for (const list of sources) {
    for (const p of list) {
      const ids = (p.ids ?? []).filter((x): x is string => !!x);
      if (ids.some((id) => seen.has(id))) continue;
      ids.forEach((id) => seen.add(id));
      out.push(p);
    }
  }
  return out;
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
  // London weeks (Monday 00:00 Europe/London), stepping back by whole London weeks.
  const starts = Array.from({ length: weeks }, (_, i) =>
    londonWeekStart(new Date(londonWeekStart(now).getTime() - 7 * DAY * (weeks - 1 - i) + 12 * 3600_000)));
  const totals = starts.map(() => 0);
  for (const p of payments) {
    if (!p.at) continue;
    const t = new Date(p.at).getTime();
    for (let i = starts.length - 1; i >= 0; i--) {
      if (t >= starts[i]!.getTime()) {
        const end = i + 1 < starts.length ? starts[i + 1]!.getTime() : londonWeekStart(new Date(starts[i]!.getTime() + 7 * DAY + 12 * 3600_000)).getTime();
        if (t < end) totals[i] += p.amount;
        break;
      }
    }
  }
  return starts.map((s, i) => ({ weekStart: s, collected: Math.round(totals[i]! * 100) / 100, current: i === starts.length - 1 }));
}

/** Neutralise spreadsheet formulas: text starting with = + - @ tab or CR gets a leading '. */
export function csvSafe(v: string | number | null | undefined): string {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** CSV for the accountant: UTF-8 BOM (Excel shows £), RFC 4180 quoting, formula-safe text cells. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = csvSafe(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
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
  /** invoices.amount_paid in PENCE; null when there is no invoice. */
  amountPaidPence: number | null;
  /** The invoice's own remaining balance in PENCE; null when there is no invoice. */
  remainingPence: number | null;
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
const depositIn = (o: SectionOrder) => !!o.jobPaidAt || !!o.depositDate || (o.amountPaidPence ?? 0) > 0;
const AFTER_PAID = new Set(['confirmed', 'in_production', 'fixed']);

/** Confirmed+ orders with no payment recorded and no invoice → Request deposit. */
export function noPaymentOrders(orders: SectionOrder[]) {
  return orders.filter((o) => isOpen(o) && AFTER_PAID.has(o.jobStage ?? '') && !depositIn(o) && !o.hasInvoice);
}

/**
 * Balance due on completion: deposit in, no second payment. The balance is the
 * invoice's own remaining amount; with no invoice it falls back to the order total,
 * flagged as an estimate (never order total − paid).
 */
export function dueOnCompletion(orders: SectionOrder[]) {
  return orders
    .filter((o) => isOpen(o) && depositIn(o) && !o.secondPaymentDate)
    .map((o) => {
      if (o.remainingPence != null) return { ...o, balance: Math.round(o.remainingPence) / 100, balanceEstimated: false };
      if (!o.hasInvoice && o.total > 0) return { ...o, balance: Math.round(o.total * 100) / 100, balanceEstimated: true };
      return { ...o, balance: null as number | null, balanceEstimated: false };
    });
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
    const key = localKey(day);
    return { day, bookings: orders.filter((o) => isOpen(o) && !!o.installationDate && localKey(localDay(o.installationDate)) === key) };
  });
}

/**
 * One shared "needs you" count for Finance (Owed to us tab) and the Hub Finance tile:
 * invoices to chase now (overdue or no due date) + open orders with no payment recorded.
 */
export function financeNeedsYou(invoices: OwedInvoice[], orders: SectionOrder[], now: Date = new Date()) {
  const queue = chaseQueue(invoices, now);
  const noPay = noPaymentOrders(orders);
  const owed = invoices.filter(isOwed);
  const owedTotal = Math.round(owed.reduce((s, i) => s + i.remainingPence, 0)) / 100;
  return { queue, noPay, count: queue.length + noPay.length, owedCount: owed.length, owedTotal };
}

/* ───────────── Hub ───────────── */

export interface WeekCompare {
  thisWeek: number;
  lastWeek: number;
}

export function countThisVsLast(dates: (string | null)[], now: Date = new Date()): WeekCompare {
  const ws = londonWeekStart(now).getTime();
  const lws = londonWeekStart(new Date(ws - 12 * 3600_000)).getTime();
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
  const ws = londonWeekStart(now).getTime();
  const lws = londonWeekStart(new Date(ws - 12 * 3600_000)).getTime();
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
