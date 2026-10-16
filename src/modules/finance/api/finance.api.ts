import { supabase } from '@/shared/lib/supabase';
import { mapFinanceTotals } from './financeTotals';

export interface FinanceTotals {
  outstandingBalance: number;
  collectedThisMonth: number;
  expectedThisMonth: number;
  overdueInvoices: number;
  overdueValue: number;
}

export interface FinanceAtRiskOrder {
  id: string;
  orderNumber: number | null;
  customerName: string;
  installDate: string | null;
  daysToInstall: number | null;
  balanceDue: number;
  totalValue: number;
  amountPaid: number;
}

export interface FinanceRecentPayment {
  id: string;
  orderId: string | null;
  orderNumber: number | null;
  customerName: string | null;
  amount: number;
  source: string;
  receivedAt: string | null;
  paymentType: string | null;
  status: string;
}

export async function fetchFinanceTotals(organizationId: string): Promise<FinanceTotals> {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc('finance_totals', { p_org: organizationId });
  if (error) throw new Error(error.message);
  return mapFinanceTotals(data);
}

export interface ConfirmedOrdersStat {
  count: number;
  /** Sum of orders_with_balance.total_order_value over the confirmed set (A1-2 ruling), GBP pounds. */
  totalOrderValue: number;
}

/** C7 (FR-023/FR-024): non-archived orders whose linked job stage = 'confirmed' — the same
 * axis the Orders page tabs group on (getOrderGroup). orders_with_balance exposes neither
 * job_id, stage, nor archived_at, so two steps: (1) confirmed ids from `orders` via the
 * jobs inner-embed, (2) total_order_value summed from orders_with_balance over those ids.
 * Org-guarded at the query layer on both steps. */
export async function fetchConfirmedOrdersStat(organizationId: string): Promise<ConfirmedOrdersStat> {
  const { data: confirmed, error } = await supabase
    .from('orders')
    .select('id, job:jobs!job_id!inner(stage)')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .eq('job.stage', 'confirmed');
  if (error) throw error;

  const ids = (confirmed ?? []).map((r) => r.id as string);
  if (ids.length === 0) return { count: 0, totalOrderValue: 0 };

  const { data: balances, error: balanceError } = await supabase
    .from('orders_with_balance')
    .select('id, total_order_value')
    .eq('organization_id', organizationId)
    .in('id', ids);
  if (balanceError) throw balanceError;

  const totalOrderValue = (balances ?? []).reduce(
    (sum, r) => sum + (Number(r.total_order_value) || 0),
    0,
  );
  return { count: ids.length, totalOrderValue };
}

export async function fetchFinanceAtRisk(
  organizationId: string,
  windowDays = 21,
): Promise<FinanceAtRiskOrder[]> {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + windowDays);

  const todayIso = today.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('orders_with_balance')
    .select('id, order_number, customer_name, installation_date, balance_due, total_order_value, amount_paid')
    .eq('organization_id', organizationId)
    .gt('balance_due', 0)
    .not('installation_date', 'is', null)
    .gte('installation_date', todayIso)
    .lte('installation_date', cutoff.toISOString().slice(0, 10))
    .order('installation_date', { ascending: true })
    .limit(20);
  if (error) throw error;

  return (data ?? []).map((r) => {
    const install = r.installation_date ? new Date(r.installation_date) : null;
    const daysToInstall = install
      ? Math.round((install.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    return {
      id: r.id as string,
      orderNumber: r.order_number as number | null,
      customerName: (r.customer_name as string) ?? 'Unknown',
      installDate: r.installation_date as string | null,
      daysToInstall,
      balanceDue: (r.balance_due as number) ?? 0,
      totalValue: (r.total_order_value as number) ?? 0,
      amountPaid: (r.amount_paid as number) ?? 0,
    };
  });
}

export async function fetchFinanceRecentPayments(
  organizationId: string,
  limit = 12,
): Promise<FinanceRecentPayment[]> {
  const { data, error } = await supabase
    .from('order_payments')
    .select('id, order_id, amount, source, received_at, payment_type, status, orders:orders!order_payments_order_id_fkey(customer_name, order_number, organization_id)')
    // Filter on the payment's own org column (indexed) — the old embedded-resource filter
    // didn't restrict the parent rows and scanned every payment.
    .eq('organization_id', organizationId)
    .order('received_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  type OrderRel = {
    customer_name: string | null;
    order_number: number | null;
    organization_id: string | null;
  } | null;
  type Row = {
    id: string;
    order_id: string | null;
    amount: number | null;
    source: string | null;
    received_at: string | null;
    payment_type: string | null;
    status: string | null;
    orders?: OrderRel;
  };
  return (data ?? []).map((raw) => {
    const r = raw as unknown as Row;
    return {
      id: r.id,
      orderId: r.order_id,
      orderNumber: r.orders?.order_number ?? null,
      customerName: r.orders?.customer_name ?? null,
      amount: r.amount ?? 0,
      source: r.source ?? 'unknown',
      receivedAt: r.received_at,
      paymentType: r.payment_type,
      status: r.status ?? 'unknown',
    };
  });
}
