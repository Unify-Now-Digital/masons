import { formatGbpPence } from '@/shared/lib/formatters';

/** Due dates at or after this ISO date are placeholder/unreliable (horizon: no-date only). */
export const UNRELIABLE_DUE_DATE_FLOOR = '2100-01-01';

/** Hub population excludes invoices below this GBP total (test/seed floor — not is_test). */
export const MIN_HUB_INVOICE_AMOUNT_GBP = 5;

export type InvoiceHorizonBucket = 'overdue' | 'due-30' | 'due-later' | 'no-date';

export type FormatInvoiceRemainingOptions = {
  /** When remaining is zero: em dash (hub default) or £0.00 (invoices table/drawer). */
  zeroDisplay?: 'dash' | 'gbp';
};

export interface InvoiceRemainingInput {
  amount: number;
  amount_paid?: number | null;
  amount_remaining?: number | null;
}

export interface HubInvoiceEligibilityInput extends InvoiceRemainingInput {
  status: string;
  stripe_invoice_status?: string | null;
}

/** Dead Stripe paper — a voided/uncollectible invoice carries no collectible balance. */
export function isVoidedStripeInvoice(row: {
  stripe_invoice_status?: string | null;
}): boolean {
  return (
    row.stripe_invoice_status === 'void' || row.stripe_invoice_status === 'uncollectible'
  );
}

function parsePaidPence(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function parseAmountPence(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n * 100));
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Canonical remaining balance in whole pence.
 * Units: `amount` is GBP pounds; `amount_paid` / `amount_remaining` are pence.
 */
export function invoiceRemainingPence(row: InvoiceRemainingInput): number {
  const remaining = row.amount_remaining;
  if (remaining != null && Number.isFinite(Number(remaining))) {
    return Math.max(0, Math.round(Number(remaining)));
  }

  const totalPence = parseAmountPence(row.amount);
  if (totalPence == null) return 0;

  const paidPence = parsePaidPence(row.amount_paid);
  if (paidPence > 0) {
    return Math.max(0, totalPence - paidPence);
  }

  return totalPence;
}

/** True when the invoice still carries an outstanding balance (shared owed definition). */
export function isInvoiceOwed(row: InvoiceRemainingInput): boolean {
  return invoiceRemainingPence(row) > 0;
}

/** GBP display string for remaining balance (single source for hub, table, drawer). */
export function formatInvoiceRemaining(
  row: InvoiceRemainingInput,
  options?: FormatInvoiceRemainingOptions,
): string {
  const pence = invoiceRemainingPence(row);
  const zeroDisplay = options?.zeroDisplay ?? 'dash';
  if (pence <= 0) {
    return zeroDisplay === 'gbp' ? formatGbpPence(0) : '—';
  }
  return formatGbpPence(pence);
}

export function isReliableDueDate(dueDate: string | null | undefined): boolean {
  if (!dueDate || !String(dueDate).trim()) return false;
  const trimmed = String(dueDate).trim().slice(0, 10);
  if (trimmed >= UNRELIABLE_DUE_DATE_FLOOR) return false;
  const d = new Date(trimmed);
  return !Number.isNaN(d.getTime());
}

export function getInvoiceHorizonBucket(
  row: InvoiceRemainingInput & { due_date?: string | null },
  today: Date = new Date(),
): InvoiceHorizonBucket {
  if (!isReliableDueDate(row.due_date)) return 'no-date';

  const due = startOfDay(new Date(String(row.due_date).slice(0, 10)));
  const t = startOfDay(today);
  const in30 = addDays(t, 30);

  if (due < t) return 'overdue';
  if (due <= in30) return 'due-30';
  return 'due-later';
}

export type OverdueAgingBucket = 'd7' | 'd7to30' | 'd30plus';

/** Whole days past due (≥1) for a reliably-dated, past-due row; null otherwise. */
export function daysPastDue(
  row: { due_date?: string | null },
  today: Date = new Date(),
): number | null {
  if (!isReliableDueDate(row.due_date)) return null;
  const due = startOfDay(new Date(String(row.due_date).slice(0, 10)));
  const t = startOfDay(today);
  if (due >= t) return null;
  return Math.round((t.getTime() - due.getTime()) / 86_400_000);
}

/** Aging bucket for an already-overdue invoice: days past due d → ≤7 / 7–30 / 30+.
 * Boundary days belong to the earlier bucket. Returns null when the due date is
 * unreliable or not past — such rows enter no aging bucket. Display-only. */
export function getOverdueAgingBucket(
  row: { due_date?: string | null },
  today: Date = new Date(),
): OverdueAgingBucket | null {
  const days = daysPastDue(row, today);
  if (days == null) return null;
  if (days <= 7) return 'd7';
  if (days <= 30) return 'd7to30';
  return 'd30plus';
}

export function getAttentionFlags(
  row: InvoiceRemainingInput & { due_date?: string | null; amount_paid?: number | null },
  today: Date = new Date(),
): { partial: boolean; overdue: boolean } {
  const owed = isInvoiceOwed(row);
  const partial = owed && parsePaidPence(row.amount_paid) > 0;
  let overdue = false;
  if (owed && isReliableDueDate(row.due_date)) {
    const due = startOfDay(new Date(String(row.due_date).slice(0, 10)));
    overdue = due < startOfDay(today);
  }
  return { partial, overdue };
}

/** Lower number = higher priority (partial+overdue first). */
export function attentionListSortKey(
  row: InvoiceRemainingInput & { due_date?: string | null; amount_paid?: number | null },
  today: Date = new Date(),
): number {
  const { partial, overdue } = getAttentionFlags(row, today);
  if (partial && overdue) return 0;
  if (overdue) return 1;
  if (partial) return 2;
  return 3;
}

/**
 * Finalized pending with a real balance — includes website-origin (e.g. INV-WEB-*)
 * once status is `pending` and owed. Unfinalized website drafts stay excluded
 * because hub fetch uses `status = 'pending'` only (not `draft`).
 */
export function isFinalizedPendingWithBalance(row: HubInvoiceEligibilityInput): boolean {
  return row.status === 'pending' && isInvoiceOwed(row);
}

export function isHubEligibleInvoice(row: HubInvoiceEligibilityInput): boolean {
  return (
    isFinalizedPendingWithBalance(row) &&
    !isVoidedStripeInvoice(row) &&
    Number(row.amount) >= MIN_HUB_INVOICE_AMOUNT_GBP
  );
}

/** Sort key for attention list: priority tier, then due date (unreliable last). */
export function compareAttentionList(
  a: InvoiceRemainingInput & { due_date?: string | null; amount_paid?: number | null },
  b: InvoiceRemainingInput & { due_date?: string | null; amount_paid?: number | null },
  today: Date = new Date(),
): number {
  const pa = attentionListSortKey(a, today);
  const pb = attentionListSortKey(b, today);
  if (pa !== pb) return pa - pb;

  const aRel = isReliableDueDate(a.due_date);
  const bRel = isReliableDueDate(b.due_date);
  if (aRel && !bRel) return -1;
  if (!aRel && bRel) return 1;
  if (!aRel && !bRel) return 0;

  return String(a.due_date).slice(0, 10).localeCompare(String(b.due_date).slice(0, 10));
}

/** PostgREST `.or()` for SQL owed prefilter — aligns with null-remaining unpaid rows. */
export function hubOwedSqlOrFilter(): string {
  return 'amount_remaining.gt.0,amount_remaining.is.null';
}
