import { supabase } from '@/shared/lib/supabase';
import { fetchAllPages } from '@/shared/lib/fetchAllPages';
import { orderRef } from '@/modules/orders/utils/orderDisplayId';
import { londonMonthRange } from '@/shared/utils/londonTime';
import { fetchLedgerTotals, isLedgerMissing, LedgerUnavailable } from './ledger.api';

type Untyped = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as Untyped;

/** Money received (pounds), one entry per ledger row; refunds/chargebacks are negative. */
export interface ReceivedPayment {
  id: string;
  amount: number;
  feeAmount: number;
  at: string | null;
  ids: string[];
  source: string;
  customer: string | null;
  reference: string | null;
  type: string | null;
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Received payments in [sinceIso, untilIso) from the unified ledger. Returns null when the
 * ledger is not set up on this database (caller falls back to the legacy tables).
 * Waiting (pending) and ignored rows are excluded; each money movement is one row, so
 * nothing is double counted.
 */
export async function fetchLedgerReceived(organizationId: string, sinceIso: string, untilIso?: string): Promise<ReceivedPayment[] | null> {
  try {
    const rows = await fetchAllPages<Row>((from, to) => {
      let q = db.from('payments')
        .select('id, source, kind, external_id, gross_pence, fee_pence, received_at, payer_name, reference_raw, payment_allocations(allocation_type, invoices(invoice_number, customer_name, orders(order_number)), orders(order_number, customer_name))')
        .eq('organization_id', organizationId)
        .not('match_status', 'in', '(ignored,pending)')
        .gte('received_at', sinceIso);
      if (untilIso) q = q.lt('received_at', untilIso);
      return q.order('received_at').order('id').range(from, to).then((res: { data: Row[] | null; error: unknown }) => {
        if (res.error && isLedgerMissing(res.error)) throw new LedgerUnavailable();
        return res;
      }) as PromiseLike<{ data: Row[] | null; error: unknown }>;
    });
    return rows.map((r) => {
      const alloc = (r.payment_allocations ?? [])[0] as Row | undefined;
      const orderNumber = alloc?.invoices?.orders?.order_number ?? alloc?.orders?.order_number ?? null;
      return {
        id: r.id,
        amount: Number(r.gross_pence) / 100,
        feeAmount: Number(r.fee_pence ?? 0) / 100,
        at: r.received_at,
        ids: [`pay:${r.id}`],
        source: r.source,
        customer: alloc?.invoices?.customer_name ?? alloc?.orders?.customer_name ?? r.payer_name ?? null,
        reference: alloc?.invoices?.invoice_number ?? (orderNumber != null ? orderRef(orderNumber) : r.reference_raw ?? null),
        type: r.kind === 'payment' ? alloc?.allocation_type ?? null : r.kind,
      };
    });
  } catch (e) {
    if (e instanceof LedgerUnavailable || isLedgerMissing(e)) return null;
    throw e;
  }
}

/**
 * "Money in this month" (pounds, gross, Europe/London month). Ledger first; when the ledger
 * is not set up, `legacy()` supplies the de-duplicated legacy sum. Each payment counts once.
 */
export async function fetchMoneyInThisMonth(
  organizationId: string,
  legacy: () => Promise<number>,
  now: Date = new Date(),
): Promise<{ amount: number; feeAmount: number | null; fromLedger: boolean }> {
  const { from, to } = londonMonthRange(now);
  try {
    const t = await fetchLedgerTotals(organizationId, from, to);
    return { amount: t.receivedPence / 100, feeAmount: t.feesPence / 100, fromLedger: true };
  } catch (e) {
    if (!(e instanceof LedgerUnavailable)) throw e;
    return { amount: await legacy(), feeAmount: null, fromLedger: false };
  }
}

export interface RecentLedgerPayment {
  id: string;
  orderId: string | null;
  orderNumber: number | null;
  customerName: string | null;
  amount: number; // pounds, gross
  source: string;
  receivedAt: string | null;
  paymentType: string | null;
  status: string;
}

/** Latest ledger rows (newest first), or null when the ledger is not set up. */
export async function fetchRecentLedgerPayments(organizationId: string, limit: number): Promise<RecentLedgerPayment[] | null> {
  const res = await db.from('payments')
    .select('id, source, kind, gross_pence, received_at, payer_name, match_status, payment_allocations(order_id, allocation_type, invoices(customer_name, order_id, orders(order_number, customer_name)), orders(order_number, customer_name))')
    .eq('organization_id', organizationId)
    .neq('match_status', 'ignored')
    .order('received_at', { ascending: false })
    .limit(limit);
  if (res.error) {
    if (isLedgerMissing(res.error)) return null;
    throw res.error;
  }
  return ((res.data ?? []) as Row[]).map((r) => {
    const a = (r.payment_allocations ?? [])[0] as Row | undefined;
    const order = a?.invoices?.orders ?? a?.orders ?? null;
    return {
      id: r.id,
      orderId: a?.order_id ?? a?.invoices?.order_id ?? null,
      orderNumber: order?.order_number ?? null,
      customerName: a?.invoices?.customer_name ?? order?.customer_name ?? r.payer_name ?? null,
      amount: Number(r.gross_pence) / 100,
      source: r.source,
      receivedAt: r.received_at,
      paymentType: r.kind === 'payment' ? a?.allocation_type ?? null : r.kind,
      status: r.match_status,
    };
  });
}
