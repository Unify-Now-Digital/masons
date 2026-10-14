import type { UIOrder } from './orderTransform';

/**
 * Orders KPI strip (r2). Each KPI is also a filter: clicking it narrows the list to exactly
 * the rows it counts. "Active" = after deposit (confirmed / in production), not exited.
 * Only real fields: stone_status, permit_status, proof_status, installation_date, paid map.
 */
export type OrderKpi = 'stone' | 'permit' | 'proof' | 'fixing' | 'balance';

export const ORDER_KPI_LABEL: Record<OrderKpi, string> = {
  stone: 'Stone not ordered',
  permit: 'Permit blocked',
  proof: 'Proof awaiting',
  fixing: 'Fixing ≤14d',
  balance: 'Balance due',
};

export const ORDER_KPI_HINT: Record<OrderKpi, string> = {
  stone: 'Deposit in, stone_status not Ordered / In Stock',
  permit: 'Permit not approved yet (not started, with family, signed, with cemetery)',
  proof: 'Proof not approved / lettered yet',
  fixing: 'Fixing date within 14 days (no SM order has a fixing date recorded yet)',
  balance: 'Paid (order_payments + Stripe) below value + permit',
};

const DAY = 86_400_000;
export const isActiveOrder = (o: UIOrder) => (o.group === 'confirmed' || o.group === 'in_production') && !o.jobExitReason;

export function matchesKpi(o: UIOrder, k: OrderKpi, now = Date.now()): boolean {
  if (!isActiveOrder(o)) return false;
  switch (k) {
    case 'stone': return !o.stoneStatus || o.stoneStatus === 'NA';
    case 'permit': return o.permitStatus !== 'approved';
    case 'proof': return !['Approved', 'Lettered'].includes(o.proofStatus);
    case 'fixing': {
      const t = o.installationDate ? Date.parse(o.installationDate) : NaN;
      return !Number.isNaN(t) && t - now <= 14 * DAY && t >= now - DAY;
    }
    case 'balance': return o.amountPaid != null && (o.total || 0) - o.amountPaid > 0.5;
  }
}

export function kpiSummary(orders: UIOrder[], now = Date.now()) {
  const out = {} as Record<OrderKpi, { count: number; value: number }>;
  for (const k of Object.keys(ORDER_KPI_LABEL) as OrderKpi[]) {
    const rows = orders.filter((o) => matchesKpi(o, k, now));
    out[k] = {
      count: rows.length,
      value: k === 'balance' ? rows.reduce((s, o) => s + Math.max(0, (o.total || 0) - (o.amountPaid ?? 0)), 0) : rows.reduce((s, o) => s + (o.total || 0), 0),
    };
  }
  return out;
}
