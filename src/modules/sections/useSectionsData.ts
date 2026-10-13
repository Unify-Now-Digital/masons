import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { useInvoicesList } from '@/modules/invoicing';
import { transformInvoiceForUI } from '@/modules/invoicing/utils/invoiceTransform';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { getOrderTotal } from '@/modules/orders/utils/orderCalculations';
import type { Order } from '@/modules/orders/types/orders.types';
import type { OwedInvoice, PaymentLike, SectionOrder } from './sectionsView';

export function toSectionOrder(o: Order): SectionOrder {
  const person = o.person_name?.trim() || null;
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
    amountPaid: o.invoice ? Number(o.invoice.amount_paid ?? 0) || 0 : null,
    hasInvoice: !!o.invoice_id,
  };
}

/** Matched order payments (pounds) + paid invoice payments (pence → pounds) since `sinceIso`. Read-only. */
async function fetchPaymentsSince(organizationId: string, sinceIso: string): Promise<PaymentLike[]> {
  const [op, ip] = await Promise.all([
    supabase
      .from('order_payments')
      .select('amount, received_at, status')
      .eq('organization_id', organizationId)
      .eq('status', 'matched')
      .gte('received_at', sinceIso),
    supabase
      .from('invoice_payments')
      .select('amount, created_at, status')
      .eq('organization_id', organizationId)
      .eq('status', 'paid')
      .gte('created_at', sinceIso),
  ]);
  if (op.error) throw op.error;
  if (ip.error) throw ip.error;
  return [
    ...(op.data ?? []).map((p) => ({ amount: Number(p.amount) || 0, at: p.received_at as string | null })),
    ...(ip.data ?? []).map((p) => ({ amount: (Number(p.amount) || 0) / 100, at: p.created_at as string | null })),
  ];
}

export function usePaymentsSince(weeks = 8) {
  const { organizationId } = useOrganization();
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - weeks * 7 - 7);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [weeks]);
  return useQuery({
    queryKey: ['sections', 'payments-since', organizationId, weeks],
    queryFn: () => fetchPaymentsSince(organizationId!, since),
    enabled: !!organizationId,
  });
}

export function useSectionOrders() {
  const q = useOrdersList();
  const orders = useMemo(() => ((q.data ?? []) as Order[]).filter((o) => !o.is_test).map(toSectionOrder), [q.data]);
  return { orders, isLoading: q.isLoading, isError: q.isError };
}

export function useOwedInvoices() {
  const q = useInvoicesList();
  const invoices: OwedInvoice[] = useMemo(
    () =>
      (q.data ?? []).map(transformInvoiceForUI).map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        orderId: i.orderId,
        customer: i.customer,
        issueDate: i.issueDate || null,
        remainingPence: i.amountRemainingPence,
        status: i.status,
      })),
    [q.data],
  );
  return { invoices, rows: q.data ?? [], isLoading: q.isLoading, isError: q.isError };
}
