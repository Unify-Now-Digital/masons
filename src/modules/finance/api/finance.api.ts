import { supabase } from '@/shared/lib/supabase';

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
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const isoMonthStart = monthStart.toISOString();
  const today = new Date();

  const { data: orders, error } = await supabase
    .from('orders')
    .select('total_order_value, amount_paid, installation_date')
    .eq('organization_id', organizationId);
  if (error) throw error;

  let outstandingBalance = 0;
  let expectedThisMonth = 0;
  for (const o of orders ?? []) {
    const total = o.total_order_value ?? 0;
    const paid = o.amount_paid ?? 0;
    const balance = Math.max(0, total - paid);
    outstandingBalance += balance;
    if (o.installation_date && o.installation_date >= isoMonthStart) {
      expectedThisMonth += balance;
    }
  }

  const { data: invoicesData } = await supabase
    .from('invoices')
    .select('amount, amount_remaining, status, due_date')
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'overdue']);

  let overdueInvoices = 0;
  let overdueValue = 0;
  for (const inv of invoicesData ?? []) {
    if (inv.status === 'overdue' || (inv.due_date && new Date(inv.due_date) < today)) {
      overdueInvoices += 1;
      // amount_remaining is bigint pence, amount is decimal(10,2) pounds.
      // Prefer the partial-payments-aware column when present.
      if (inv.amount_remaining != null) {
        overdueValue += Number(inv.amount_remaining) / 100;
      } else {
        overdueValue += Number(inv.amount ?? 0);
      }
    }
  }

  const { data: payments } = await supabase
    .from('invoice_payments')
    .select('amount, created_at')
    .gte('created_at', isoMonthStart);
  const collectedThisMonth = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0) / 100;

  return {
    outstandingBalance,
    collectedThisMonth,
    expectedThisMonth,
    overdueInvoices,
    overdueValue,
  };
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
    .eq('orders.organization_id', organizationId)
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
    const r = raw as Row;
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
