import { supabase } from '@/shared/lib/supabase';

export type PrioritySeverity = 'high' | 'med';
export type PrioritySource = 'ai' | 'manual';
export type PriorityRoute =
  | 'finance'
  | 'proofs'
  | 'permits'
  | 'orders'
  | 'hub';

export interface PriorityItem {
  key: string; // unique composite
  orderId: string;
  orderNumber: number | null;
  customerName: string;
  headline: string;
  rationale: string;
  nextStep: string;
  nextAction: string;
  severity: PrioritySeverity;
  source: PrioritySource;
  route: PriorityRoute;
  value?: number | null;
  age: string; // "7d", "31d with council", etc.
}

const currency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);

const DAY = 1000 * 60 * 60 * 24;
const daysBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY);

/**
 * Aggregate signals across existing tables into a single ranked list of
 * priority items. Purely computed — no priority store yet.
 */
export async function fetchPriorityQueue(organizationId: string): Promise<PriorityItem[]> {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const in21 = new Date(today.getTime() + 21 * DAY).toISOString().slice(0, 10);

  const [balanceRes, proofRes, permitRes, overdueRes, manualRes, cemeteriesRes] = await Promise.all([
    // 1. At-risk balances (install ≤ 21d, balance > 0)
    supabase
      .from('orders_with_balance')
      .select('id, order_number, customer_name, installation_date, balance_due, priority')
      .eq('organization_id', organizationId)
      .gt('balance_due', 0)
      .not('installation_date', 'is', null)
      .gte('installation_date', todayIso)
      .lte('installation_date', in21)
      .order('installation_date', { ascending: true }),

    // 2. Stalled proofs: sent without approval, or change-requested with no follow-up
    supabase
      .from('order_proofs')
      .select('id, order_id, state, sent_at, approved_at, changes_requested_at, orders:orders!inner(id, organization_id, order_number, customer_name, value, total_order_value)')
      .eq('orders.organization_id', organizationId)
      .in('state', ['sent', 'changes_requested'])
      .is('approved_at', null),

    // 3. Stalled permits: submitted >avg_approval_days or with_customer >10d
    supabase
      .from('order_permits')
      .select('id, order_id, permit_phase, updated_at, orders:orders!inner(id, organization_id, order_number, customer_name, value, total_order_value, cemetery_id)')
      .eq('orders.organization_id', organizationId)
      .in('permit_phase', ['SUBMITTED', 'SENT_TO_CLIENT']),

    // 4. Overdue orders (due_date past, progress<100)
    supabase
      .from('orders')
      .select('id, order_number, customer_name, due_date, progress, value, total_order_value')
      .eq('organization_id', organizationId)
      .lt('due_date', todayIso)
      .lt('progress', 100),

    // 5. Manually-flagged priority orders
    supabase
      .from('orders')
      .select('id, order_number, customer_name, value, total_order_value, priority, progress')
      .eq('organization_id', organizationId)
      .eq('priority', 'high')
      .lt('progress', 100),

    // Cemeteries for avg_approval_days lookup
    supabase.from('cemeteries').select('id, avg_approval_days'),
  ]);

  const items: PriorityItem[] = [];
  const seenManual = new Set<string>();

  // --- 1. Balance chase ---
  for (const rawRow of balanceRes.data ?? []) {
    const row = rawRow as {
      id: string;
      order_number: number | null;
      customer_name: string;
      installation_date: string | null;
      balance_due: number | null;
      priority: string | null;
    };
    const install = row.installation_date ? new Date(row.installation_date) : null;
    if (!install) continue;
    const days = daysBetween(install, today);
    const severity: PrioritySeverity = days <= 7 ? 'high' : 'med';
    items.push({
      key: `balance:${row.id}`,
      orderId: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      headline: `${currency(row.balance_due ?? 0)} unpaid, install in ${days}d`,
      rationale: 'Balance invoice hasn\u2019t cleared and the stone is booked to leave the yard.',
      nextStep: 'Send the balance reminder and confirm payment before install day.',
      nextAction: 'Chase balance',
      severity,
      source: 'ai',
      route: 'finance',
      value: row.balance_due ?? null,
      age: `${days}d to install`,
    });
  }

  // --- 2. Stalled proofs ---
  type ProofRow = {
    id: string;
    order_id: string;
    state: string;
    sent_at: string | null;
    approved_at: string | null;
    changes_requested_at: string | null;
    orders: {
      id: string;
      organization_id: string | null;
      order_number: number | null;
      customer_name: string;
      value: number | null;
      total_order_value: number | null;
    } | null;
  };
  for (const rawProof of proofRes.data ?? []) {
    const proof = rawProof as ProofRow;
    if (!proof.orders) continue;
    if (proof.state === 'sent' && proof.sent_at) {
      const sentDays = daysBetween(today, new Date(proof.sent_at));
      if (sentDays >= 5) {
        const severity: PrioritySeverity = sentDays >= 10 ? 'high' : 'med';
        items.push({
          key: `proof-sent:${proof.id}`,
          orderId: proof.orders.id,
          orderNumber: proof.orders.order_number,
          customerName: proof.orders.customer_name,
          headline: `Proof awaiting approval · ${sentDays}d silent`,
          rationale: 'Customer has had the proof more than five days without responding.',
          nextStep: 'Gentle chase — offer a call if they want to discuss edits.',
          nextAction: 'Chase customer',
          severity,
          source: 'ai',
          route: 'proofs',
          value: proof.orders.total_order_value ?? proof.orders.value ?? null,
          age: `${sentDays}d since sent`,
        });
      }
    } else if (proof.state === 'changes_requested' && proof.changes_requested_at) {
      const reqDays = daysBetween(today, new Date(proof.changes_requested_at));
      if (reqDays >= 3) {
        const severity: PrioritySeverity = reqDays >= 7 ? 'high' : 'med';
        items.push({
          key: `proof-changes:${proof.id}`,
          orderId: proof.orders.id,
          orderNumber: proof.orders.order_number,
          customerName: proof.orders.customer_name,
          headline: `Revisions requested ${reqDays}d ago`,
          rationale: 'Customer asked for changes but no revised proof has been sent back.',
          nextStep: 'Draft the revision and send it back today.',
          nextAction: 'Open proof',
          severity,
          source: 'ai',
          route: 'proofs',
          value: proof.orders.total_order_value ?? proof.orders.value ?? null,
          age: `${reqDays}d since request`,
        });
      }
    }
  }

  // --- 3. Stalled permits ---
  const cemeteries: Record<string, number> = {};
  for (const cemRaw of cemeteriesRes.data ?? []) {
    const c = cemRaw as { id: string; avg_approval_days: number | null };
    cemeteries[c.id] = c.avg_approval_days ?? 28;
  }
  type PermitRow = {
    id: string;
    order_id: string;
    permit_phase: string;
    updated_at: string;
    orders: {
      id: string;
      organization_id: string | null;
      order_number: number | null;
      customer_name: string;
      value: number | null;
      total_order_value: number | null;
      cemetery_id: string | null;
    } | null;
  };
  for (const rawPermit of permitRes.data ?? []) {
    const permit = rawPermit as PermitRow;
    if (!permit.orders || !permit.updated_at) continue;
    const inPhaseDays = daysBetween(today, new Date(permit.updated_at));
    if (permit.permit_phase === 'SUBMITTED') {
      const avg = permit.orders.cemetery_id ? cemeteries[permit.orders.cemetery_id] ?? 28 : 28;
      if (inPhaseDays > avg) {
        const severity: PrioritySeverity = inPhaseDays > avg + 7 ? 'high' : 'med';
        items.push({
          key: `permit-submitted:${permit.id}`,
          orderId: permit.orders.id,
          orderNumber: permit.orders.order_number,
          customerName: permit.orders.customer_name,
          headline: `Permit overdue with council · ${inPhaseDays}d`,
          rationale: `Beyond the cemetery\u2019s ${avg}-day average approval time.`,
          nextStep: 'Escalate — polite or firm tone depending on prior chases.',
          nextAction: 'Chase council',
          severity,
          source: 'ai',
          route: 'permits',
          value: permit.orders.total_order_value ?? permit.orders.value ?? null,
          age: `${inPhaseDays}d submitted`,
        });
      }
    } else if (permit.permit_phase === 'SENT_TO_CLIENT' && inPhaseDays >= 10) {
      const severity: PrioritySeverity = inPhaseDays >= 14 ? 'high' : 'med';
      items.push({
        key: `permit-customer:${permit.id}`,
        orderId: permit.orders.id,
        orderNumber: permit.orders.order_number,
        customerName: permit.orders.customer_name,
        headline: `Customer hasn\u2019t returned paperwork · ${inPhaseDays}d`,
        rationale: 'Permit form is with the customer but hasn\u2019t come back.',
        nextStep: 'Call or re-send the form; offer to collect by post.',
        nextAction: 'Chase customer',
        severity,
        source: 'ai',
        route: 'permits',
        value: permit.orders.total_order_value ?? permit.orders.value ?? null,
        age: `${inPhaseDays}d with customer`,
      });
    }
  }

  // --- 4. Overdue orders ---
  for (const rawRow of overdueRes.data ?? []) {
    const row = rawRow as {
      id: string;
      order_number: number | null;
      customer_name: string;
      due_date: string | null;
      progress: number | null;
      value: number | null;
      total_order_value: number | null;
    };
    const due = row.due_date ? new Date(row.due_date) : null;
    if (!due) continue;
    const daysOver = daysBetween(today, due);
    if (daysOver <= 0) continue;
    const severity: PrioritySeverity = daysOver > 7 ? 'high' : 'med';
    items.push({
      key: `overdue:${row.id}`,
      orderId: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      headline: `Overdue by ${daysOver}d · ${row.progress ?? 0}% done`,
      rationale: 'Due date has passed and the order isn\u2019t complete.',
      nextStep: 'Review progress and set a new expected date.',
      nextAction: 'Open order',
      severity,
      source: 'ai',
      route: 'orders',
      value: row.total_order_value ?? row.value ?? null,
      age: `${daysOver}d overdue`,
    });
  }

  // --- 5. Manual flags ---
  for (const rawRow of manualRes.data ?? []) {
    const row = rawRow as {
      id: string;
      order_number: number | null;
      customer_name: string;
      value: number | null;
      total_order_value: number | null;
    };
    // If the same order already appears from an AI signal, flip source to manual and keep it
    const existing = items.find((i) => i.orderId === row.id);
    if (existing) {
      existing.source = 'manual';
      existing.severity = 'high';
      continue;
    }
    seenManual.add(row.id);
    items.push({
      key: `manual:${row.id}`,
      orderId: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      headline: 'Manually flagged as priority',
      rationale: 'A team member set this order\u2019s priority to high.',
      nextStep: 'Review and take the next step.',
      nextAction: 'Open order',
      severity: 'high',
      source: 'manual',
      route: 'orders',
      value: row.total_order_value ?? row.value ?? null,
      age: 'flagged',
    });
  }

  // Rank: high before med, then by value desc
  items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return (b.value ?? 0) - (a.value ?? 0);
  });

  return items;
}
