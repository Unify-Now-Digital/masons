/**
 * Finance v2 (page-review-v2 §3): per-order receivables, cash in, reconciliation flags.
 * Pure functions over one brand's rows (BrandData) — CM and SM are never mixed.
 *
 *   owed = order value + permit_cost − Σ payments
 *   Σ payments = matched order_payments + paid invoices whose Stripe payment is not already
 *                an order_payments row (deduped on payment-intent id), so a payment is never
 *                counted twice and full-value Stripe invoices (no order_payments row) still count.
 */
import type { BrandData, InvoiceRow, OrderRow } from '@/modules/today/brandData.types';

const DAY = 86_400_000;
export const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number.parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const ts = (iso?: string | null) => {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(n) ? n : null;
};
const daysAgo = (iso: string | null | undefined, now: number) => {
  const n = ts(iso);
  return n == null ? null : Math.floor((now - n) / DAY);
};

export const orderTotal = (o: Pick<OrderRow, 'value' | 'permit_cost'>) => r2(num(o.value) + num(o.permit_cost));
export const orderRef = (o: Pick<OrderRow, 'order_number'>) => (o.order_number != null ? `#${o.order_number}` : '—');
export const orderName = (o: Pick<OrderRow, 'person_name' | 'customer_name'>) => o.person_name?.trim() || o.customer_name?.trim() || '—';

/** Test/seed rows (£1/£3/£10 "test" orders) stay out of receivables. */
export const isTestOrder = (o: OrderRow) => !!o.is_test || orderTotal(o) < 5 || /^test$/i.test((o.customer_name ?? '').trim());
export const isTestInvoice = (i: InvoiceRow) => !!i.is_test || num(i.amount) < 5;

/** Mason pending invoice whose Stripe invoice was voided: not collectable as-is. */
export const isVoidInStripe = (i: InvoiceRow) =>
  i.status !== 'paid' && (i.stripe_invoice_status === 'void' || i.stripe_invoice_status === 'uncollectible');
export const isOpenInvoice = (i: InvoiceRow) => i.status !== 'paid' && i.status !== 'void';

export type Source = 'revolut' | 'stripe' | 'bank' | 'other';
export const normSource = (s: string | null | undefined): Source => {
  const v = (s ?? '').toLowerCase();
  if (v.includes('revolut')) return 'revolut';
  if (v.includes('stripe')) return 'stripe';
  if (v.includes('bank') || v.includes('barclays') || v.includes('transfer')) return 'bank';
  return 'other';
};

export interface PaymentEvent {
  id: string; orderId: string | null; invoiceId: string | null; at: string | null; amount: number; source: Source;
  type: string | null; reference: string | null; matched: boolean;
}

/** Every payment once: matched + unmatched order_payments, plus paid Stripe invoice payments not already present. */
export function paymentEvents(d: Pick<BrandData, 'orderPayments' | 'invoicePayments' | 'invoices'>): PaymentEvent[] {
  const seen = new Set<string>();
  const out: PaymentEvent[] = [];
  for (const p of d.orderPayments) {
    if (p.external_id) seen.add(p.external_id);
    out.push({
      id: `op:${p.id}`, orderId: p.order_id, invoiceId: null, at: p.received_at, amount: num(p.amount),
      source: normSource(p.source), type: p.payment_type, reference: p.reference, matched: p.status === 'matched',
    });
  }
  const invOrder = new Map(d.invoices.map((i) => [i.id, i]));
  for (const p of d.invoicePayments) {
    if (p.status !== 'paid') continue;
    if ((p.stripe_payment_intent_id && seen.has(p.stripe_payment_intent_id)) || (p.stripe_charge_id && seen.has(p.stripe_charge_id))) continue;
    const inv = p.invoice_id ? invOrder.get(p.invoice_id) : undefined;
    out.push({
      id: `ip:${p.id}`, orderId: inv?.order_id ?? null, invoiceId: p.invoice_id, at: p.received_at ?? p.created_at,
      amount: num(p.amount) / 100, source: 'stripe', type: 'invoice', reference: inv?.invoice_number ?? null, matched: true,
    });
  }
  return out.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
}

export interface CashIn { total: number; revolut: number; stripe: number; other: number; count: number }
const emptyCash = (): CashIn => ({ total: 0, revolut: 0, stripe: 0, other: 0, count: 0 });
export function cashBetween(events: PaymentEvent[], from: number, to: number): CashIn {
  const c = emptyCash();
  for (const e of events) {
    const t = ts(e.at);
    if (!e.matched || t == null || t < from || t >= to) continue;
    c.total += e.amount; c.count += 1;
    if (e.source === 'revolut') c.revolut += e.amount;
    else if (e.source === 'stripe') c.stripe += e.amount;
    else c.other += e.amount;
  }
  return { total: r2(c.total), revolut: r2(c.revolut), stripe: r2(c.stripe), other: r2(c.other), count: c.count };
}

export type ReceivableAction = 'Record payment' | 'Chase' | 'Raise invoice' | 'Match' | 'Request balance';
export interface Receivable {
  orderId: string; ref: string; name: string; total: number; paid: number; remaining: number;
  sources: Source[]; depositIn: boolean; installationDate: string | null; stoneStatus: string | null;
  openInvoice: InvoiceRow | null; action: ReceivableAction | null; colour: 'red' | 'amber' | 'green' | 'blue'; why: string;
  ageDays: number | null; jobStage: string | null;
}

const OPEN_STAGES = new Set(['confirmed', 'invoiced', 'in_production', 'fixed', 'complete']);

export function isReceivableOrder(o: OrderRow, paid: number): boolean {
  if (isTestOrder(o)) return false;
  if (o.job?.exit_reason) return false;
  return OPEN_STAGES.has(o.job?.stage ?? '') || !!o.deposit_date || paid > 0;
}

export function receivables(d: BrandData, now: number): Receivable[] {
  const events = paymentEvents(d);
  const out: Receivable[] = [];
  for (const o of d.orders) {
    const mine = events.filter((e) => e.matched && e.orderId === o.id);
    const paid = r2(mine.reduce((s, e) => s + e.amount, 0));
    if (!isReceivableOrder(o, paid)) continue;
    const total = orderTotal(o);
    const remaining = r2(Math.max(0, total - paid));
    const depositIn = paid > 0 || !!o.deposit_date || !!o.job?.paid_at;
    const openInv = d.invoices.find((i) => i.order_id === o.id && isOpenInvoice(i) && !isTestInvoice(i)) ?? null;
    const daysToFix = o.installation_date ? Math.ceil(((ts(o.installation_date) ?? now) - now) / DAY) : null;
    let action: ReceivableAction | null = null;
    let colour: Receivable['colour'] = 'blue';
    let why = '';
    let ageDays: number | null = null;
    if (remaining <= 1) {
      colour = 'green'; why = 'Paid in full';
    } else if (o.deposit_date && paid === 0) {
      action = 'Record payment'; colour = 'red';
      why = `Deposit marked ${o.deposit_date} but no amount recorded${openInv && isVoidInStripe(openInv) ? ' · Stripe invoice void' : ''}`;
      ageDays = daysAgo(o.deposit_date, now);
    } else if (depositIn && (daysToFix != null ? daysToFix <= 30 : o.stone_status === 'In Stock')) {
      action = 'Request balance'; colour = daysToFix != null && daysToFix <= 7 ? 'red' : 'amber';
      why = daysToFix != null ? `Fixing in ${daysToFix}d` : 'Stone in stock, no fixing date';
    } else if (openInv && !isVoidInStripe(openInv)) {
      ageDays = daysAgo(openInv.issue_date ?? openInv.created_at, now);
      if ((ageDays ?? 0) > 5) { action = 'Chase'; colour = (ageDays ?? 0) > 30 ? 'red' : 'amber'; why = `${openInv.invoice_number} unpaid ${ageDays}d`; }
      else { colour = 'blue'; why = `${openInv.invoice_number} sent ${ageDays}d ago`; }
    } else if (!depositIn) {
      action = openInv ? 'Match' : 'Raise invoice'; colour = 'amber';
      why = openInv ? `${openInv.invoice_number} is void in Stripe: check where the deposit went` : 'No deposit and no live invoice';
      ageDays = daysAgo(o.created_at, now);
    } else {
      colour = 'blue'; why = 'Balance due on fixing';
    }
    out.push({
      orderId: o.id, ref: orderRef(o), name: orderName(o), total, paid, remaining, sources: [...new Set(mine.map((e) => e.source))],
      depositIn, installationDate: o.installation_date, stoneStatus: o.stone_status, openInvoice: openInv, action, colour, why, ageDays,
      jobStage: o.job?.stage ?? null,
    });
  }
  const rank = { red: 0, amber: 1, blue: 2, green: 3 } as const;
  return out.sort((a, b) => rank[a.colour] - rank[b.colour] || b.remaining - a.remaining);
}

export type AgeBucket = '0–7d' | '8–30d' | '31–90d' | '90d+';
export const AGE_BUCKETS: AgeBucket[] = ['0–7d', '8–30d', '31–90d', '90d+'];
const bucketOf = (d: number): AgeBucket => (d <= 7 ? '0–7d' : d <= 30 ? '8–30d' : d <= 90 ? '31–90d' : '90d+');

export interface InvoiceSummary {
  live: { count: number; total: number; buckets: Record<AgeBucket, { count: number; total: number }> };
  voidInStripe: { count: number; total: number; rows: InvoiceRow[] };
}
/** Unpaid Mason invoices. Those voided in Stripe are reported separately, never silently dropped. */
export function invoiceSummary(invoices: InvoiceRow[], now: number): InvoiceSummary {
  const buckets = Object.fromEntries(AGE_BUCKETS.map((b) => [b, { count: 0, total: 0 }])) as InvoiceSummary['live']['buckets'];
  const live = { count: 0, total: 0, buckets };
  const voided = { count: 0, total: 0, rows: [] as InvoiceRow[] };
  for (const i of invoices) {
    if (!isOpenInvoice(i) || isTestInvoice(i)) continue;
    const amt = num(i.amount);
    if (isVoidInStripe(i)) { voided.count++; voided.total = r2(voided.total + amt); voided.rows.push(i); continue; }
    const b = bucketOf(Math.max(0, daysAgo(i.issue_date ?? i.created_at, now) ?? 0));
    live.count++; live.total = r2(live.total + amt); buckets[b].count++; buckets[b].total = r2(buckets[b].total + amt);
  }
  voided.rows.sort((a, b) => num(b.amount) - num(a.amount));
  return { live, voidInStripe: voided };
}

export type FlagKind = 'Barclays (unverified)' | 'Mason vs Stripe mismatch' | 'Void in Stripe, pending in Mason' | 'Invoice with no order' | 'Order value ≠ invoice';
export interface ReconFlag { kind: FlagKind; ref: string; name: string; detail: string; amount: number }

export function reconciliationFlags(d: BrandData): ReconFlag[] {
  const flags: ReconFlag[] = [];
  const opExt = new Set(d.orderPayments.map((p) => p.external_id).filter(Boolean) as string[]);
  const orders = new Map(d.orders.map((o) => [o.id, o]));
  for (const i of d.invoices) {
    if (isTestInvoice(i) || i.status === 'void') continue;
    const amt = num(i.amount);
    const ref = i.invoice_number ?? '—';
    const name = i.customer_name ?? '—';
    const pays = d.invoicePayments.filter((p) => p.invoice_id === i.id && p.status === 'paid');
    if (i.status === 'paid') {
      const stripePaid = r2(pays.reduce((s, p) => s + num(p.amount) / 100, 0));
      const viaOp = !!i.stripe_payment_intent_id && opExt.has(i.stripe_payment_intent_id);
      if (!pays.length && !viaOp) flags.push({ kind: 'Barclays (unverified)', ref, name, detail: 'Marked paid with no Stripe charge or receipt', amount: amt });
      else if (pays.length && Math.abs(stripePaid - amt) > 1)
        flags.push({ kind: 'Mason vs Stripe mismatch', ref, name, detail: `Mason £${amt.toFixed(2)} vs Stripe £${stripePaid.toFixed(2)}`, amount: r2(amt - stripePaid) });
      const o = i.order_id ? orders.get(i.order_id) : undefined;
      if (o && !isTestOrder(o) && Math.abs(orderTotal(o) - amt) > 1)
        flags.push({ kind: 'Order value ≠ invoice', ref: `${orderRef(o)} · ${ref}`, name, detail: `Order £${orderTotal(o).toFixed(2)} vs invoice £${amt.toFixed(2)}`, amount: r2(amt - orderTotal(o)) });
    } else if (isVoidInStripe(i)) {
      flags.push({ kind: 'Void in Stripe, pending in Mason', ref, name, detail: i.order_id ? 'Mark paid (if paid outside Stripe) or void in Mason' : 'No order linked either', amount: amt });
    } else if (!i.order_id) {
      flags.push({ kind: 'Invoice with no order', ref, name, detail: 'Link it to an order', amount: amt });
    }
  }
  return flags;
}

/** Orders this new count as "deposit to request" (team: ~1–2 a day). */
export const DEPOSIT_WINDOW_DAYS = 30;

export interface FinanceKpis {
  today: CashIn; mtd: CashIn; lastPayment: { at: string; amount: number; source: Source } | null;
  invoices: InvoiceSummary;
  depositsToRequest: Receivable[];
  balances: { count: number; total: number; next30Count: number; next30Total: number; unknownDepositCount: number };
  owed: { count: number; total: number };
}

export function financeKpis(d: BrandData, now: number): FinanceKpis {
  const events = paymentEvents(d);
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  const month = new Date(day.getFullYear(), day.getMonth(), 1).getTime();
  const rec = receivables(d, now);
  const last = events.find((e) => e.matched && e.at);
  // Deposit amount unknown (deposit_date but no payment row): the balance can't be known yet,
  // so those orders are counted apart instead of inflating "balances due" at full value.
  const unknownDeposit = rec.filter((r) => r.action === 'Record payment');
  const bal = rec.filter((r) => r.depositIn && r.remaining > 1 && r.action !== 'Record payment');
  const n30 = bal.filter((r) => r.installationDate && (ts(r.installationDate)! - now) / DAY <= 30);
  return {
    today: cashBetween(events, day.getTime(), day.getTime() + DAY),
    mtd: cashBetween(events, month, now + 1),
    lastPayment: last ? { at: last.at!, amount: last.amount, source: last.source } : null,
    invoices: invoiceSummary(d.invoices, now),
    // New wins only (order created ≤ 30d): old no-deposit orders are pipeline clean-up, not today's requests.
    depositsToRequest: rec.filter((r) => !r.depositIn && r.remaining > 1 && (r.action === 'Raise invoice' || r.action === 'Match') && (r.ageDays ?? 0) <= DEPOSIT_WINDOW_DAYS),
    balances: { count: bal.length, total: r2(bal.reduce((s, r) => s + r.remaining, 0)), next30Count: n30.length, next30Total: r2(n30.reduce((s, r) => s + r.remaining, 0)), unknownDepositCount: unknownDeposit.length },
    owed: { count: rec.filter((r) => r.remaining > 1).length, total: r2(rec.reduce((s, r) => s + r.remaining, 0)) },
  };
}

/** Default amount for Record payment: SM deposit is 50% of the order; balance = what's left. */
export function suggestedAmount(r: Pick<Receivable, 'total' | 'paid' | 'remaining'>, type: 'deposit' | 'final'): number {
  return type === 'deposit' && r.paid === 0 ? r2(r.total / 2) : r.remaining;
}
