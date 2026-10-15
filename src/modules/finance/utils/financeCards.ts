// Finance stat-strip cards: Order book / Collected / Invoiced unpaid / Still to invoice /
// Expected total / Unmatched. Pure so it can be unit-tested; all amounts GBP pounds.
// Order value INCLUDES the permit fee (greatest of permit_cost / permit_fee) so the cards
// reconcile with Stripe invoice totals, which bill the permit.

export interface CardOrder {
  id: string;
  total_order_value: number | string | null;
  permit_cost?: number | string | null;
  permit_fee?: number | string | null;
  installation_date?: string | null;
}

export interface CardInvoice {
  order_id: string | null;
  amount: number | string | null;
  amount_paid?: number | string | null; // pence
  amount_remaining?: number | string | null; // pence
  status: string | null;
  stripe_invoice_status?: string | null;
  invoice_type?: string | null;
  due_date?: string | null;
  stripe_link_status?: string | null;
}

export interface CardOrderPayment {
  order_id: string | null;
  amount: number | string | null;
  payment_type?: string | null;
}

export interface FinanceCards {
  orderBook: number;
  orderCount: number;
  collected: number;
  collectedDeposit: number;
  collectedBalance: number;
  invoicedUnpaid: number;
  overdue: number;
  overdueCount: number;
  stillToInvoice: number;
  expectedTotal: number;
  dueThisMonth: number;
  unmatchedCount: number;
  unmatchedValue: number;
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number.parseFloat(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const orderValueWithPermit = (o: CardOrder) =>
  num(o.total_order_value) + Math.max(num(o.permit_cost), num(o.permit_fee));

const isDead = (i: CardInvoice) =>
  i.status === 'cancelled' ||
  i.status === 'draft' ||
  i.stripe_invoice_status === 'void' ||
  i.stripe_invoice_status === 'uncollectible';

/** Paid portion of an invoice in pounds. */
export function invoicePaid(i: CardInvoice): number {
  if (i.status === 'paid') return num(i.amount);
  return Math.min(num(i.amount), num(i.amount_paid) / 100);
}

/** Unpaid portion of an invoice in pounds. */
export function invoiceUnpaid(i: CardInvoice): number {
  if (i.status === 'paid' || isDead(i)) return 0;
  if (i.amount_remaining != null) return Math.max(0, num(i.amount_remaining) / 100);
  return Math.max(0, num(i.amount) - num(i.amount_paid) / 100);
}

const isDeposit = (type: string | null | undefined) => (type ?? '').toLowerCase() === 'deposit';

export function buildFinanceCards(
  orders: CardOrder[],
  invoices: CardInvoice[],
  orderPayments: CardOrderPayment[],
  today: Date,
): FinanceCards {
  const todayIso = today.toISOString().slice(0, 10);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const monthEndIso = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;
  const monthStartIso = monthEndIso.slice(0, 8) + '01';

  const live = invoices.filter((i) => !isDead(i));
  const covered = new Map<string, number>(); // order_id -> invoiced + off-invoice payments
  const c: FinanceCards = {
    orderBook: 0, orderCount: 0, collected: 0, collectedDeposit: 0, collectedBalance: 0,
    invoicedUnpaid: 0, overdue: 0, overdueCount: 0, stillToInvoice: 0, expectedTotal: 0,
    dueThisMonth: 0, unmatchedCount: 0, unmatchedValue: 0,
  };

  for (const i of live) {
    const paid = invoicePaid(i);
    const unpaid = invoiceUnpaid(i);
    c.collected += paid;
    if (isDeposit(i.invoice_type)) c.collectedDeposit += paid;
    else c.collectedBalance += paid;
    c.invoicedUnpaid += unpaid;
    const due = i.due_date ? String(i.due_date).slice(0, 10) : null;
    if (unpaid > 0 && due && due < todayIso) {
      c.overdue += unpaid;
      c.overdueCount += 1;
    }
    if (unpaid > 0 && (!due || due <= monthEndIso)) c.dueThisMonth += unpaid;
    if (i.order_id) covered.set(i.order_id, (covered.get(i.order_id) ?? 0) + num(i.amount));
    if (i.stripe_link_status === 'unmatched') {
      c.unmatchedCount += 1;
      c.unmatchedValue += num(i.amount);
    }
  }

  for (const p of orderPayments) {
    const amt = num(p.amount);
    c.collected += amt;
    if (isDeposit(p.payment_type)) c.collectedDeposit += amt;
    else c.collectedBalance += amt;
    if (p.order_id) covered.set(p.order_id, (covered.get(p.order_id) ?? 0) + amt);
  }

  for (const o of orders) {
    const value = orderValueWithPermit(o);
    c.orderBook += value;
    c.orderCount += 1;
    const rest = Math.max(0, value - (covered.get(o.id) ?? 0));
    c.stillToInvoice += rest;
    const inst = o.installation_date ? String(o.installation_date).slice(0, 10) : null;
    if (rest > 0 && inst && inst >= monthStartIso && inst <= monthEndIso) c.dueThisMonth += rest;
  }

  c.expectedTotal = c.invoicedUnpaid + c.stillToInvoice;
  return c;
}
