import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { fetchAllPages } from '@/shared/lib/fetchAllPages';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useTestDataMode } from '@/shared/context/TestDataContext';
import { fetchAllOrdersPaged } from '@/modules/orders/api/orders.api';
import { INVOICES_LIST_SELECT } from '@/modules/invoicing/api/invoicing.api';
import { transformInvoiceForUI } from '@/modules/invoicing/utils/invoiceTransform';
import type { Invoice } from '@/modules/invoicing/types/invoicing.types';
import { formatOrderNumber, getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { getOrderTotal } from '@/modules/orders/utils/orderCalculations';
import { orderInvoicePence } from '@/shared/lib/orderPanel';
import type { Order } from '@/modules/orders/types/orders.types';
import { dedupePayments, type OwedInvoice, type PaymentLike, type SectionOrder } from './sectionsView';
import { fetchLedgerReceived } from '@/modules/ledger/api/moneyIn';

/** Re-read sections data on focus and every 5 minutes so week buckets roll over. */
const LIVE = { staleTime: 60_000, refetchOnWindowFocus: true, refetchInterval: 5 * 60_000 } as const;

/** `new Date()` that refreshes on window focus and every minute (week/age boundaries). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);
  return now;
}

/** Local midnight `days` ago, as an ISO string (day-rounded so it is a stable query key). */
export function dayStartIso(now: Date, daysAgo: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return d.toISOString();
}

export function toSectionOrder(o: Order): SectionOrder {
  const person = o.person_name?.trim() || null;
  // invoices.amount_paid / amount_remaining are PENCE; amount is pounds.
  const inv = orderInvoicePence(o.invoice);
  return {
    id: o.id,
    ref: getOrderDisplayId(o),
    customer: person || o.customer_name || '—',
    forName: person && o.customer_name && o.customer_name !== person ? o.customer_name : null,
    location: o.location ?? null,
    jobStage: o.job?.stage ?? null,
    jobPaidAt: o.job?.paid_at ?? null,
    jobExitReason: o.job?.exit_reason ?? null,
    depositDate: o.deposit_date ?? null,
    secondPaymentDate: o.second_payment_date ?? null,
    stoneStatus: o.stone_status ?? null,
    permitStatus: o.permit_status ?? null,
    proofStatus: o.proof_status ?? null,
    installationDate: o.installation_date ?? null,
    total: getOrderTotal(o),
    amountPaidPence: o.invoice ? inv.amountPaidPence : o.invoice_id ? 0 : null,
    remainingPence: inv.remainingPence,
    hasInvoice: !!o.invoice_id,
  };
}

type OrderPaymentRow = { id: string; external_id: string | null; amount: number | string; received_at: string | null };
type InvoicePaymentRow = {
  id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  amount: number | string;
  created_at: string | null;
};

/**
 * Matched order payments (pounds) + paid invoice payments (pence → pounds) in
 * [sinceIso, untilIso), paged past the row cap and de-duplicated on the Stripe
 * payment-intent / charge id so one payment is never counted twice. Read-only.
 */
export async function fetchPaymentsBetween(organizationId: string, sinceIso: string, untilIso?: string): Promise<PaymentLike[]> {
  const ledger = await fetchLedgerReceived(organizationId, sinceIso, untilIso);
  if (ledger) return ledger.map((p) => ({ amount: p.amount, at: p.at, ids: p.ids }));
  return fetchLegacyPaymentsBetween(organizationId, sinceIso, untilIso);
}

/** Pre-ledger fallback: matched order payments + paid invoice payments, de-duplicated. */
export async function fetchLegacyPaymentsBetween(organizationId: string, sinceIso: string, untilIso?: string): Promise<PaymentLike[]> {
  const [op, ip] = await Promise.all([
    fetchAllPages<OrderPaymentRow>((from, to) => {
      let q = supabase
        .from('order_payments')
        .select('id, external_id, amount, received_at')
        .eq('organization_id', organizationId)
        .eq('status', 'matched')
        .gte('received_at', sinceIso);
      if (untilIso) q = q.lt('received_at', untilIso);
      return q.order('received_at').order('id').range(from, to) as unknown as PromiseLike<{ data: OrderPaymentRow[] | null; error: unknown }>;
    }),
    fetchAllPages<InvoicePaymentRow>((from, to) => {
      let q = supabase
        .from('invoice_payments')
        .select('id, stripe_payment_intent_id, stripe_charge_id, amount, created_at')
        .eq('organization_id', organizationId)
        .eq('status', 'paid')
        .gte('created_at', sinceIso);
      if (untilIso) q = q.lt('created_at', untilIso);
      return q.order('created_at').order('id').range(from, to) as unknown as PromiseLike<{ data: InvoicePaymentRow[] | null; error: unknown }>;
    }),
  ]);
  return dedupePayments([
    op.map((p) => ({ amount: Number(p.amount) || 0, at: p.received_at, ids: [`op:${p.id}`, p.external_id] })),
    ip.map((p) => ({
      amount: (Number(p.amount) || 0) / 100,
      at: p.created_at,
      ids: [`ip:${p.id}`, p.stripe_payment_intent_id, p.stripe_charge_id],
    })),
  ]);
}

/** Payments for the last `weeks` weeks (+1 for this-vs-last), keyed by the day-rounded window start. */
export function usePaymentsSince(weeks: number, now: Date) {
  const { organizationId } = useOrganization();
  const since = dayStartIso(now, weeks * 7 + 7);
  return useQuery({
    queryKey: ['sections', 'payments-since', organizationId, since],
    queryFn: () => fetchPaymentsBetween(organizationId!, since),
    enabled: !!organizationId,
    ...LIVE,
  });
}

export function useSectionOrders() {
  const { organizationId } = useOrganization();
  const { showTestData } = useTestDataMode();
  const excludeTest = !showTestData;
  // Under ['orders'] so order mutations (which invalidate ['orders']) refresh it.
  const q = useQuery({
    queryKey: ['orders', 'sections-all', organizationId, { excludeTest }],
    queryFn: () => fetchAllOrdersPaged(organizationId!, { excludeTest }),
    enabled: !!organizationId,
    ...LIVE,
  });
  const orders = useMemo(() => ((q.data ?? []) as Order[]).filter((o) => !o.is_test).map(toSectionOrder), [q.data]);
  return { orders, isLoading: q.isLoading, isError: q.isError };
}

/** Owed invoices only (server-side: not paid / void / deleted), paged past the row cap. */
async function fetchOwedInvoiceRows(organizationId: string, excludeTest: boolean): Promise<Invoice[]> {
  return fetchAllPages<Invoice>((from, to) => {
    let q = supabase
      .from('invoices_with_breakdown')
      .select(INVOICES_LIST_SELECT)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .not('status', 'in', '(paid,void)');
    if (excludeTest) q = q.eq('is_test', false);
    return q.order('created_at', { ascending: false }).order('id').range(from, to) as unknown as PromiseLike<{ data: Invoice[] | null; error: unknown }>;
  });
}

export function useOwedInvoices() {
  const { organizationId } = useOrganization();
  const { showTestData } = useTestDataMode();
  const excludeTest = !showTestData;
  // Under ['invoices'] so invoice/payment mutations (which invalidate ['invoices']) refresh it.
  const q = useQuery({
    queryKey: ['invoices', 'sections-owed', organizationId, { excludeTest }],
    queryFn: () => fetchOwedInvoiceRows(organizationId!, excludeTest),
    enabled: !!organizationId,
    ...LIVE,
  });
  const invoices: OwedInvoice[] = useMemo(
    () =>
      (q.data ?? []).map(transformInvoiceForUI).map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        orderId: i.orderId,
        customer: i.customer,
        issueDate: i.issueDate || null,
        dueDate: i.dueDate || null,
        remainingPence: i.amountRemainingPence,
        status: i.status,
      })),
    [q.data],
  );
  return { invoices, isLoading: q.isLoading, isError: q.isError };
}

/** Count of live (non-void, non-deleted) invoices, server-side (head count, no rows). */
export function useLiveInvoiceCount() {
  const { organizationId } = useOrganization();
  const { showTestData } = useTestDataMode();
  const excludeTest = !showTestData;
  return useQuery({
    queryKey: ['invoices', 'sections-live-count', organizationId, { excludeTest }],
    queryFn: async () => {
      let q = supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId!)
        .is('deleted_at', null)
        .neq('status', 'void');
      if (excludeTest) q = q.eq('is_test', false);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!organizationId,
    ...LIVE,
  });
}

export interface LedgerPayment {
  at: string | null;
  customer: string | null;
  reference: string | null;
  amount: number; // pounds
  source: string;
  type: string | null;
  ids: (string | null)[];
}

type LedgerOpRow = {
  id: string; external_id: string | null; amount: number | string; received_at: string | null; source: string | null; payment_type: string | null;
  orders: { customer_name: string | null; order_number: number | null } | null;
};
type LedgerIpRow = {
  id: string; stripe_payment_intent_id: string | null; stripe_charge_id: string | null; amount: number | string; created_at: string | null;
  invoices: { invoice_number: string | null; customer_name: string | null } | null;
};

/**
 * Every collected payment in [sinceIso, untilIso) for the accountant export: matched
 * order payments + paid Stripe invoice payments, paged, each real payment once. Read-only.
 */
export async function fetchPaymentLedger(organizationId: string, sinceIso: string, untilIso: string): Promise<LedgerPayment[]> {
  const ledger = await fetchLedgerReceived(organizationId, sinceIso, untilIso);
  if (ledger) {
    return ledger.map((p) => ({ at: p.at, customer: p.customer, reference: p.reference, amount: p.amount, source: p.source, type: p.type, ids: p.ids }));
  }
  const [op, ip] = await Promise.all([
    fetchAllPages<LedgerOpRow>((from, to) =>
      supabase
        .from('order_payments')
        .select('id, external_id, amount, received_at, source, payment_type, orders:orders!order_payments_order_id_fkey(customer_name, order_number)')
        .eq('organization_id', organizationId)
        .eq('status', 'matched')
        .gte('received_at', sinceIso)
        .lt('received_at', untilIso)
        .order('received_at')
        .order('id')
        .range(from, to) as unknown as PromiseLike<{ data: LedgerOpRow[] | null; error: unknown }>,
    ),
    fetchAllPages<LedgerIpRow>((from, to) =>
      supabase
        .from('invoice_payments')
        .select('id, stripe_payment_intent_id, stripe_charge_id, amount, created_at, invoices(invoice_number, customer_name)')
        .eq('organization_id', organizationId)
        .eq('status', 'paid')
        .gte('created_at', sinceIso)
        .lt('created_at', untilIso)
        .order('created_at')
        .order('id')
        .range(from, to) as unknown as PromiseLike<{ data: LedgerIpRow[] | null; error: unknown }>,
    ),
  ]);
  const seen = new Set<string>();
  const out: LedgerPayment[] = [];
  const add = (p: LedgerPayment) => {
    const ids = p.ids.filter((x): x is string => !!x);
    if (ids.some((id) => seen.has(id))) return;
    ids.forEach((id) => seen.add(id));
    out.push(p);
  };
  for (const p of op) {
    add({
      at: p.received_at, customer: p.orders?.customer_name ?? null,
      reference: p.orders?.order_number != null ? formatOrderNumber(p.orders.order_number) : null,
      amount: Number(p.amount) || 0, source: p.source ?? 'unknown', type: p.payment_type, ids: [`op:${p.id}`, p.external_id],
    });
  }
  for (const p of ip) {
    add({
      at: p.created_at, customer: p.invoices?.customer_name ?? null, reference: p.invoices?.invoice_number ?? null,
      amount: (Number(p.amount) || 0) / 100, source: 'stripe invoice', type: null,
      ids: [`ip:${p.id}`, p.stripe_payment_intent_id, p.stripe_charge_id],
    });
  }
  return out.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
}
