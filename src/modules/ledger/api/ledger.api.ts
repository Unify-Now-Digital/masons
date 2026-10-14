import { supabase } from '@/shared/lib/supabase';
import { isLedgerMissing } from './ledgerErrors';

export { isLedgerMissing };

/**
 * Unified payments ledger (payments + payment_allocations). Browser access is read-only
 * through RLS (finance roles); every change goes through an audited SECURITY DEFINER RPC.
 * Amounts are integer pence. The raw provider payload is never selected here.
 *
 * Until the ledger migration is applied the tables/RPCs do not exist: callers get
 * `LedgerUnavailable` and fall back (or show a "not set up yet" state) instead of erroring.
 */

// The generated DB types predate the ledger; use an untyped view of the client for it.
type Untyped = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};
const db = supabase as unknown as Untyped;

export class LedgerUnavailable extends Error {
  constructor() {
    super('The payments ledger is not set up on this database yet');
    this.name = 'LedgerUnavailable';
  }
}

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) {
    if (isLedgerMissing(res.error)) throw new LedgerUnavailable();
    throw res.error;
  }
  return res.data;
}

export type PaymentSource = 'stripe' | 'revolut' | 'manual';
export type MatchStatus = 'matched' | 'suggested' | 'unmatched' | 'ignored' | 'pending';
export type AllocationType = 'deposit' | 'balance' | 'permit' | 'extra' | 'credit';

export interface LedgerAllocation {
  id: string;
  invoiceId: string | null;
  orderId: string | null;
  amountPence: number;
  type: AllocationType | string;
  invoiceNumber: string | null;
  invoiceType: string | null;
  orderNumber: number | null;
}

export interface LedgerSuggestion {
  invoiceId: string | null;
  orderId: string | null;
  score: number;
  reasons: string[];
  invoiceNumber: string | null;
  orderNumber: number | null;
  customerName: string | null;
  remainingPence: number | null;
}

export interface LedgerPaymentRow {
  id: string;
  source: PaymentSource;
  kind: string;
  receivedAt: string;
  grossPence: number;
  feePence: number;
  netPence: number;
  currency: string;
  payerName: string | null;
  payerEmail: string | null;
  /** The customer (payer) person's name; never the deceased. */
  customerName: string | null;
  /** Memorial / deceased name, shown only as muted secondary text. */
  memorialName: string | null;
  reference: string | null;
  method: string | null;
  isPassThrough: boolean;
  status: MatchStatus;
  matchReason: string | null;
  allocations: LedgerAllocation[];
  suggestions: LedgerSuggestion[];
}

const PAYMENT_COLUMNS = [
  'id', 'source', 'kind', 'received_at', 'gross_pence', 'fee_pence', 'net_pence', 'currency',
  'payer_name', 'payer_email', 'reference_raw', 'method', 'is_pass_through', 'match_status', 'match_reason',
].join(', ');

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface LedgerFilters {
  from?: string; // YYYY-MM-DD (London)
  to?: string;
  source?: PaymentSource | 'all';
}

export async function fetchLedgerPayments(organizationId: string, filters: LedgerFilters = {}): Promise<LedgerPaymentRow[]> {
  let q = db.from('payments').select(PAYMENT_COLUMNS).eq('organization_id', organizationId);
  if (filters.source && filters.source !== 'all') q = q.eq('source', filters.source);
  if (filters.from) q = q.gte('received_at', filters.from);
  if (filters.to) q = q.lte('received_at', `${filters.to}T23:59:59.999Z`);
  const payments = check<Row[] | null>(await q.order('received_at', { ascending: false }).limit(500)) ?? [];
  if (!payments.length) return [];
  const ids = payments.map((p) => p.id as string);

  const [allocs, suggs] = await Promise.all([
    db.from('payment_allocations')
      .select('id, payment_id, invoice_id, order_id, amount_pence, allocation_type, invoices(invoice_number, invoice_type, customer_name, orders(order_number, customer_name, person_name)), orders(order_number, customer_name, person_name)')
      .in('payment_id', ids),
    db.from('payment_match_suggestions')
      .select('payment_id, invoice_id, order_id, score, reasons, invoices(invoice_number, customer_name, amount_remaining, total_pence), orders(order_number, customer_name)')
      .in('payment_id', ids)
      .order('score', { ascending: false }),
  ]);
  const allocRows = check<Row[] | null>(allocs) ?? [];
  const suggRows = check<Row[] | null>(suggs) ?? [];

  return payments.map((p) => {
    const a = allocRows.filter((r) => r.payment_id === p.id);
    const firstOrder = a.map((r) => r.invoices?.orders ?? r.orders).find(Boolean) as Row | undefined;
    return {
      id: p.id,
      source: p.source,
      kind: p.kind,
      receivedAt: p.received_at,
      grossPence: Number(p.gross_pence),
      feePence: Number(p.fee_pence ?? 0),
      netPence: Number(p.net_pence ?? Number(p.gross_pence) - Number(p.fee_pence ?? 0)),
      currency: p.currency ?? 'GBP',
      payerName: p.payer_name,
      payerEmail: p.payer_email,
      customerName: firstOrder?.customer_name ?? a.map((r) => r.invoices?.customer_name).find(Boolean) ?? null,
      memorialName: firstOrder?.person_name ?? null,
      reference: p.reference_raw,
      method: p.method,
      isPassThrough: !!p.is_pass_through,
      status: p.match_status,
      matchReason: p.match_reason,
      allocations: a.map((r) => ({
        id: r.id,
        invoiceId: r.invoice_id,
        orderId: r.order_id,
        amountPence: Number(r.amount_pence),
        type: r.allocation_type,
        invoiceNumber: r.invoices?.invoice_number ?? null,
        invoiceType: r.invoices?.invoice_type ?? null,
        orderNumber: (r.invoices?.orders ?? r.orders)?.order_number ?? null,
      })),
      suggestions: suggRows.filter((r) => r.payment_id === p.id).map((r) => ({
        invoiceId: r.invoice_id,
        orderId: r.order_id,
        score: Number(r.score ?? 0),
        reasons: Array.isArray(r.reasons) ? r.reasons : [],
        invoiceNumber: r.invoices?.invoice_number ?? null,
        orderNumber: r.orders?.order_number ?? null,
        customerName: r.invoices?.customer_name ?? r.orders?.customer_name ?? null,
        remainingPence: r.invoices?.amount_remaining != null ? Number(r.invoices.amount_remaining) : null,
      })),
    };
  });
}

export interface LedgerTotals {
  receivedPence: number;
  feesPence: number;
  netPence: number;
  passThroughPence: number;
  revenuePence: number;
  unallocatedPence: number;
  refundsPence: number;
  paymentCount: number;
}

/** Totals on the Europe/London calendar, inclusive dates (YYYY-MM-DD). */
export async function fetchLedgerTotals(organizationId: string, from: string, to: string): Promise<LedgerTotals> {
  const rows = check<Row[] | Row | null>(await db.rpc('ledger_totals', { p_org: organizationId, p_from: from, p_to: to }));
  const r = (Array.isArray(rows) ? rows[0] : rows) ?? {};
  const n = (v: unknown) => Number(v ?? 0);
  return {
    receivedPence: n(r.received_pence), feesPence: n(r.fees_pence), netPence: n(r.net_pence),
    passThroughPence: n(r.pass_through_pence), revenuePence: n(r.revenue_pence),
    unallocatedPence: n(r.unallocated_pence), refundsPence: n(r.refunds_pence), paymentCount: n(r.payment_count),
  };
}

// ---- Actions (audited RPCs; the DB records who and when) ----

export async function confirmSuggestion(paymentId: string, invoiceId: string | null, orderId: string | null): Promise<void> {
  check(await db.rpc('ledger_confirm_suggestion', { p_payment: paymentId, p_invoice: invoiceId, p_order: orderId }));
}

export interface AllocationInput { invoiceId?: string | null; orderId?: string | null; amountPence: number; type?: AllocationType }

/** Manual match / split: one or more allocations, saved atomically (audited). */
export async function allocatePayment(paymentId: string, allocations: AllocationInput[], note?: string): Promise<void> {
  check(await db.rpc('ledger_allocate', {
    p_payment: paymentId,
    p_allocations: allocations.map((a) => ({
      invoice_id: a.invoiceId ?? null, order_id: a.orderId ?? null, amount_pence: a.amountPence, allocation_type: a.type ?? null,
    })),
    p_note: note ?? null,
  }));
}

export async function unmatchPayment(paymentId: string, reason: string): Promise<void> {
  check(await db.rpc('ledger_unmatch', { p_payment: paymentId, p_reason: reason }));
}

export async function ignorePayment(paymentId: string, reason: string): Promise<void> {
  check(await db.rpc('ledger_ignore', { p_payment: paymentId, p_reason: reason }));
}

export async function recordManualPayment(input: {
  organizationId: string; grossPence: number; receivedAt: string; method: 'cash' | 'cheque' | 'bank_transfer' | 'other';
  payerName: string; reference?: string; invoiceId?: string | null; note?: string;
}): Promise<void> {
  check(await db.rpc('ledger_record_manual_payment', {
    p_org: input.organizationId, p_gross_pence: input.grossPence, p_received_at: input.receivedAt, p_method: input.method,
    p_payer_name: input.payerName, p_reference: input.reference ?? null, p_invoice: input.invoiceId ?? null, p_note: input.note ?? null,
  }));
}

/** Probe: is the ledger migration applied on this database? (Checks a ledger-only column.) */
export async function ledgerAvailable(): Promise<boolean> {
  const res = await db.from('payments').select('gross_pence', { head: true, count: 'exact' }).limit(1);
  if (!res.error) return true;
  if (isLedgerMissing(res.error)) return false;
  throw res.error;
}

/** Open invoices for the manual match picker (search by invoice no., ORD-/OR- no. or customer). */
export async function searchOpenInvoices(organizationId: string, search: string): Promise<OpenInvoiceOption[]> {
  const q = search.trim().replace(/[,()%*]/g, '');
  const digits = q.replace(/^(ord|or|inv)[\s#:-]*/i, '').replace(/^0+/, '');
  const numeric = !!q && /^\d+$/.test(digits);
  const base = () => db.from('invoices')
    .select('id, invoice_number, customer_name, invoice_type, total_pence, orders(order_number)')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .not('status', 'in', '(paid,cancelled)')
    .order('created_at', { ascending: false })
    .limit(20);
  let req = base();
  if (numeric) req = req.ilike('invoice_number', `%${digits}%`);
  else if (q) req = req.or(`invoice_number.ilike.%${q}%,customer_name.ilike.%${q}%`);
  let rows = check<Row[] | null>(await req) ?? [];
  if (numeric) {
    // Order-number search too: invoices whose order has that number.
    const byOrder = check<Row[] | null>(await db.from('invoices')
      .select('id, invoice_number, customer_name, invoice_type, total_pence, orders!inner(order_number)')
      .eq('organization_id', organizationId).is('deleted_at', null).not('status', 'in', '(paid,cancelled)')
      .eq('orders.order_number', Number(digits)).limit(20)) ?? [];
    const seen = new Set(rows.map((r) => r.id));
    rows = rows.concat(byOrder.filter((r) => !seen.has(r.id)));
  }
  if (!rows.length) return [];
  const balances = check<Row[] | null>(await db.from('invoice_balances')
    .select('invoice_id, remaining_pence').in('invoice_id', rows.map((r) => r.id))) ?? [];
  const remaining = new Map(balances.map((b) => [b.invoice_id as string, Number(b.remaining_pence)]));
  return rows
    .map((r) => ({
      invoiceId: r.id as string,
      invoiceNumber: r.invoice_number as string,
      customerName: (r.customer_name as string | null) ?? null,
      orderNumber: (r.orders?.order_number as number | null) ?? null,
      invoiceType: (r.invoice_type as string | null) ?? null,
      remainingPence: remaining.get(r.id) ?? Number(r.total_pence ?? 0),
    }))
    .filter((o) => o.remainingPence > 0);
}

/**
 * Old order_payments writers call this first. Once the ledger exists the legacy tables are
 * frozen (DB trigger), so stop early with a clear pointer instead of a database error.
 */
export async function assertLegacyPaymentsWritable(): Promise<void> {
  if (await ledgerAvailable()) {
    throw new Error('Payments are now matched in Finance › Payments. This older screen is read-only.');
  }
}

/** Payments allocated to one invoice, from the ledger; null when the ledger is not set up. */
export async function fetchInvoiceAllocations(invoiceId: string): Promise<Array<{
  id: string; paymentId: string; amountPence: number; type: string; receivedAt: string; source: PaymentSource;
  stripePaymentIntentId: string | null; externalId: string;
}> | null> {
  const res = await db.from('payment_allocations')
    .select('id, payment_id, amount_pence, allocation_type, created_at, payments(received_at, source, external_id, stripe_payment_intent_id)')
    .eq('invoice_id', invoiceId)
    .order('created_at');
  if (res.error) {
    if (isLedgerMissing(res.error)) return null;
    throw res.error;
  }
  return ((res.data ?? []) as Row[]).map((r) => ({
    id: r.id, paymentId: r.payment_id, amountPence: Number(r.amount_pence), type: r.allocation_type,
    receivedAt: r.payments?.received_at ?? r.created_at, source: r.payments?.source ?? 'manual',
    stripePaymentIntentId: r.payments?.stripe_payment_intent_id ?? null, externalId: r.payments?.external_id ?? '',
  }));
}
