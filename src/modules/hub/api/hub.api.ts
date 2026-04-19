import { supabase } from '@/shared/lib/supabase';

export type DerivedOrderStage = 'design' | 'proof' | 'lettering' | 'permit' | 'install_ready';

export interface HubSummary {
  totalOpen: number;
  readyForInstall: number;
  overdue: number;
  pendingApproval: number;
  avgProgress: number | null;
}

export interface HubPipelineStage {
  stage: DerivedOrderStage;
  label: string;
  count: number;
  sampleCustomers: string[];
}

export interface HubKpi {
  jobsOpen: number;
  avgJobValue: number;
  jobsThisMonth: number;
  outstandingBalance: number;
  collectedThisMonth: number;
  expectedThisMonth: number;
}

export interface HubAtRiskOrder {
  id: string;
  orderNumber: number | null;
  customerName: string;
  installDate: string | null;
  daysToInstall: number | null;
  balanceDue: number;
  totalValue: number;
  amountPaid: number;
}

export interface HubRecentPayment {
  id: string;
  orderId: string | null;
  orderNumber: number | null;
  customerName: string | null;
  amount: number;
  source: string;
  receivedAt: string | null;
  paymentType: string | null;
}

/**
 * Single-status → design-stage mapping. Orders can sit in more than one bucket
 * (e.g. proof not yet received AND permit approved); we pick the "earliest"
 * open stage so the pipeline reflects the bottleneck.
 */
function deriveOrderStage(o: {
  proof_status: string | null;
  permit_status: string | null;
  stone_status: string | null;
}): DerivedOrderStage {
  if (o.proof_status === 'Not_Received' || o.proof_status === 'NA') return 'design';
  if (o.proof_status === 'Received' || o.proof_status === 'In_Progress') return 'proof';
  if (o.proof_status === 'Lettered' && o.permit_status !== 'approved') return 'lettering';
  if (o.permit_status === 'pending' || o.permit_status === 'form_sent' || o.permit_status === 'customer_completed') {
    return 'permit';
  }
  return 'install_ready';
}

const STAGE_LABELS: Record<DerivedOrderStage, string> = {
  design: 'Design',
  proof: 'Proof',
  lettering: 'Lettering',
  permit: 'Permit',
  install_ready: 'Install-ready',
};

export async function fetchHubSummary(organizationId: string): Promise<HubSummary> {
  const { data, error } = await supabase
    .from('orders')
    .select('progress, stone_status, permit_status, proof_status, due_date')
    .eq('organization_id', organizationId);

  if (error) throw error;
  const rows = data ?? [];
  const today = new Date();

  const readyForInstall = rows.filter(
    (r) => r.stone_status === 'In Stock' && r.permit_status === 'approved' && r.proof_status === 'Lettered',
  ).length;
  const overdue = rows.filter(
    (r) => r.due_date && new Date(r.due_date) < today && (r.progress ?? 0) < 100,
  ).length;
  const pendingApproval = rows.filter(
    (r) => ['pending', 'form_sent'].includes(r.permit_status) || r.proof_status === 'Not_Received',
  ).length;
  const avgProgress =
    rows.length === 0
      ? null
      : rows.reduce((sum, r) => sum + (r.progress ?? 0), 0) / rows.length;

  return {
    totalOpen: rows.length,
    readyForInstall,
    overdue,
    pendingApproval,
    avgProgress,
  };
}

export async function fetchHubPipeline(organizationId: string): Promise<HubPipelineStage[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, customer_name, stone_status, permit_status, proof_status, progress')
    .eq('organization_id', organizationId)
    .lt('progress', 100);

  if (error) throw error;
  const rows = data ?? [];
  const stages: DerivedOrderStage[] = ['design', 'proof', 'lettering', 'permit', 'install_ready'];
  const byStage: Record<DerivedOrderStage, string[]> = {
    design: [],
    proof: [],
    lettering: [],
    permit: [],
    install_ready: [],
  };
  for (const row of rows) {
    const stage = deriveOrderStage(row);
    byStage[stage].push(row.customer_name ?? 'Unknown');
  }
  return stages.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: byStage[stage].length,
    sampleCustomers: byStage[stage].slice(0, 3),
  }));
}

export async function fetchHubKpis(organizationId: string): Promise<HubKpi> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const isoMonthStart = monthStart.toISOString();

  const { data: ordersData, error: ordersErr } = await supabase
    .from('orders')
    .select('value, total_order_value, amount_paid, progress, created_at, installation_date')
    .eq('organization_id', organizationId);
  if (ordersErr) throw ordersErr;
  const orders = ordersData ?? [];

  const openOrders = orders.filter((o) => (o.progress ?? 0) < 100);
  const values = openOrders.map((o) => o.value ?? o.total_order_value ?? 0).filter((v) => v > 0);
  const avgJobValue = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  const jobsThisMonth = orders.filter((o) => o.created_at && o.created_at >= isoMonthStart).length;

  const outstandingBalance = orders.reduce(
    (s, o) => s + Math.max(0, (o.total_order_value ?? 0) - (o.amount_paid ?? 0)),
    0,
  );
  const expectedThisMonth = orders
    .filter((o) => o.installation_date && o.installation_date >= isoMonthStart)
    .reduce((s, o) => s + Math.max(0, (o.total_order_value ?? 0) - (o.amount_paid ?? 0)), 0);

  const { data: paymentsData } = await supabase
    .from('invoice_payments')
    .select('amount, created_at')
    .gte('created_at', isoMonthStart);
  const collectedThisMonth = (paymentsData ?? []).reduce((s, p) => s + (p.amount ?? 0), 0) / 100;

  return {
    jobsOpen: openOrders.length,
    avgJobValue,
    jobsThisMonth,
    outstandingBalance,
    collectedThisMonth,
    expectedThisMonth,
  };
}

export async function fetchHubAtRisk(
  organizationId: string,
  windowDays = 21,
): Promise<HubAtRiskOrder[]> {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + windowDays);

  const { data, error } = await supabase
    .from('orders_with_balance')
    .select('id, order_number, customer_name, installation_date, balance_due, total_order_value, amount_paid')
    .eq('organization_id', organizationId)
    .gt('balance_due', 0)
    .not('installation_date', 'is', null)
    .lte('installation_date', cutoff.toISOString().slice(0, 10))
    .order('installation_date', { ascending: true })
    .limit(8);

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

export async function fetchHubRecentPayments(
  organizationId: string,
  limit = 6,
): Promise<HubRecentPayment[]> {
  const { data, error } = await supabase
    .from('order_payments')
    .select('id, order_id, amount, source, received_at, payment_type, orders:orders!order_payments_order_id_fkey(customer_name, order_number, organization_id)')
    .eq('orders.organization_id', organizationId)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  type OrderRel = { customer_name: string | null; order_number: number | null; organization_id: string | null } | null;
  type Row = {
    id: string;
    order_id: string | null;
    amount: number | null;
    source: string | null;
    received_at: string | null;
    payment_type: string | null;
    orders?: OrderRel;
  };
  return (data ?? []).map((raw) => {
    const r = raw as Row;
    const order = r.orders ?? null;
    return {
      id: r.id,
      orderId: r.order_id,
      orderNumber: order?.order_number ?? null,
      customerName: order?.customer_name ?? null,
      amount: r.amount ?? 0,
      source: r.source ?? 'unknown',
      receivedAt: r.received_at,
      paymentType: r.payment_type,
    };
  });
}
