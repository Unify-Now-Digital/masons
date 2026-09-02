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
  /** When 'paid', remaining is 0 by rule (FR-017) regardless of Stripe amounts. */
  status?: string | null;
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
  // FR-017 fold: a paid invoice never carries a collectible balance, even when the
  // Stripe pence columns are missing or stale (absorbs computeTotals' 2026-08-26 override).
  if (row.status === 'paid') return 0;
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

/** Signed whole-day offset to the due date (negative = overdue); null if unreliable. */
function dueOffsetDays(
  row: { due_date?: string | null },
  today: Date,
): number | null {
  if (!isReliableDueDate(row.due_date)) return null;
  const due = startOfDay(new Date(String(row.due_date).slice(0, 10)));
  const t = startOfDay(today);
  return Math.round((due.getTime() - t.getTime()) / 86_400_000);
}

/** Whole days past due (≥1) for a reliably-dated, past-due row; null otherwise. */
export function daysPastDue(
  row: { due_date?: string | null },
  today: Date = new Date(),
): number | null {
  const off = dueOffsetDays(row, today);
  return off != null && off < 0 ? -off : null;
}

/** Whole days until due (0 = due today) for a reliably-dated, not-yet-due row; null otherwise. */
export function daysUntilDue(
  row: { due_date?: string | null },
  today: Date = new Date(),
): number | null {
  const off = dueOffsetDays(row, today);
  return off != null && off >= 0 ? off : null;
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

// ——— C2: unified tile classification + summary (contracts/bucket-helpers.md) ———

/** Tile buckets. null = no bucket: not hub-eligible, or eligible with no reliable due date
 * (visible under 'all' only — spec A-2). */
export type AgingBucket = 'd7' | 'd7to30' | 'd30plus' | 'notYetDue' | null;

/** Tile filter state: the four aging buckets plus 'all' (no filter). */
export type TileFilter = 'd7' | 'd7to30' | 'd30plus' | 'notYetDue' | 'all';

// ——— C7 (Amendment 1): stats 2–5 as table filters (contracts/stat-filter-props.md) ———

/** Stat-strip filters (FR-025): Invoiced & unpaid / Collected / Expected / Overdue. */
export type StatFilter = 'unpaid' | 'collected' | 'expected' | 'overdue';

/** ONE active filter across chips AND stats (FR-026); TileFilter already includes 'all'. */
export type ActiveFilter = TileFilter | StatFilter;

const STAT_FILTERS: readonly StatFilter[] = ['unpaid', 'collected', 'expected', 'overdue'];

export function isStatFilter(filter: ActiveFilter): filter is StatFilter {
  return (STAT_FILTERS as readonly string[]).includes(filter);
}

export interface FinanceSummary {
  buckets: Record<'d7' | 'd7to30' | 'd30plus' | 'notYetDue', { count: number; totalPence: number }>;
  /** Ribbon "Invoiced & unpaid" (≡ the retired Hub summary's totalOutstandingGbp). */
  invoicedUnpaidGbp: number;
  /** Ribbon "Overdue" (≡ totalOverdueGbp). */
  overdueGbp: number;
  /** Ribbon "Overdue" secondary count (ex horizon.overdue.count — due-horizon dependent 2). */
  overdueCount: number;
  /** No hub-eligible row in the working set (ex allHorizonZero — dependent 4). */
  allZero: boolean;
}

/**
 * Single classification for tiles AND table (SC-001): a row appears under exactly the tile
 * it is counted in, by construction. Hub-eligibility gates the four buckets; ineligible
 * rows (paid, void, sub-£5, not owed) and eligible rows without a reliable due date
 * classify null. notYetDue = horizon due-30 + due-later (due-horizon dependent 1).
 */
export function classifyRowForFilter(
  row: HubInvoiceEligibilityInput & { due_date?: string | null },
  today: Date = new Date(),
): AgingBucket {
  if (!isHubEligibleInvoice(row)) return null;
  const aging = getOverdueAgingBucket(row, today);
  if (aging != null) return aging;
  const horizon = getInvoiceHorizonBucket(row, today);
  if (horizon === 'due-30' || horizon === 'due-later') return 'notYetDue';
  return null; // 'no-date'
}

/** Row shape for matchesStatFilter: classifyRowForFilter's input plus the payment/install
 * fields the stat filters read. (contracts/stat-filter-props.md names FinanceInvoiceRow —
 * retired in C5; this is its structural stand-in.) */
export type StatFilterRow = HubInvoiceEligibilityInput & {
  due_date?: string | null;
  paid_at?: string | null;
  /** FR-029a: embedded via `order:orders!invoices_order_id_fkey(installation_date)`. */
  order?: { installation_date: string | null } | null;
};

/** True when a date (plain YYYY-MM-DD or ISO timestamp) falls in `today`'s calendar month.
 * Date-only strings compare by YYYY-MM prefix (no TZ parse — spec A1-5 discipline);
 * timestamps parse and compare in local time. */
function isInCurrentCalendarMonth(value: string, today: Date): boolean {
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed.startsWith(monthPrefix);
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
}

/**
 * Stat-filter predicate (FR-025/FR-027) — classifyRowForFilter's family: the bucket cases
 * DELEGATE to it, never re-derive. Stated divergences (spec A1-3/A1-4, correct as specced):
 * 'unpaid' can list fewer rows than the stat £ (eligible no-reliable-due-date rows are in
 * the £ but bucket null); 'collected' misses partial payments (no paid_at) and order-level
 * payments (the stat caption states "incl. order-level payments").
 */
export function matchesStatFilter(
  row: StatFilterRow,
  filter: StatFilter,
  today: Date = new Date(),
): boolean {
  switch (filter) {
    case 'unpaid':
      return classifyRowForFilter(row, today) !== null;
    case 'overdue': {
      const bucket = classifyRowForFilter(row, today);
      return bucket === 'd7' || bucket === 'd7to30' || bucket === 'd30plus';
    }
    case 'collected':
      return row.paid_at != null && isInCurrentCalendarMonth(row.paid_at, today);
    case 'expected': {
      const install = row.order?.installation_date;
      return install != null && isInCurrentCalendarMonth(install, today);
    }
  }
}

/**
 * Derived aggregates over the unified working set (post enquiry-hiding, pre tile filter).
 * Ribbon semantics identical to the retired Hub summary (quickstart step-0 baseline):
 * attention-flag overdue ≡ horizon 'overdue' for eligible rows (identical guards), so
 * overdueCount ≡ horizon.overdue.count and the three overdue buckets partition it
 * exactly (dependent 3).
 */
export function buildFinanceSummary(
  rows: (HubInvoiceEligibilityInput & { due_date?: string | null })[],
  today: Date = new Date(),
): FinanceSummary {
  const zero = () => ({ count: 0, totalPence: 0 });
  const buckets = { d7: zero(), d7to30: zero(), d30plus: zero(), notYetDue: zero() };
  let invoicedUnpaidGbp = 0;
  let overdueGbp = 0;
  let overdueCount = 0;
  let anyEligible = false;

  for (const row of rows) {
    if (!isHubEligibleInvoice(row)) continue;
    anyEligible = true;
    const pence = invoiceRemainingPence(row);
    invoicedUnpaidGbp += pence / 100;
    if (getAttentionFlags(row, today).overdue) {
      overdueGbp += pence / 100;
      overdueCount += 1;
    }
    const bucket = classifyRowForFilter(row, today);
    if (bucket != null) {
      buckets[bucket].count += 1;
      buckets[bucket].totalPence += pence;
    }
  }

  return { buckets, invoicedUnpaidGbp, overdueGbp, overdueCount, allZero: !anyEligible };
}
