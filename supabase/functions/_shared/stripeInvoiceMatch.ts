// Pure matching logic for invoices created OUTSIDE Mason (directly in the Stripe dashboard).
// No Deno / npm imports: shared by stripe-webhook (Deno), scripts/import-stripe-invoices.mjs
// (via the mirrored JS in that script) and vitest.
//
// Match order (first hit wins):
//   1. metadata.mason_invoice_id / metadata.invoice_id -> existing Mason invoice
//   2. ORD ref (ORD-000123) in metadata.order / order_ref / order_number, then description/footer/memo
//   3. customer email -> people (same org) -> that person's SINGLE open order
//   otherwise 'unmatched'

export type StripeInvoiceLike = {
  id: string;
  number?: string | null;
  customer_email?: string | null;
  description?: string | null;
  footer?: string | null;
  metadata?: Record<string, string> | null;
};

const ORD_RE = /\bORD[-\s]?0*(\d{1,9})\b/i;

/** Returns the order NUMBER referenced by the invoice (e.g. 282 for "ORD-000282"), or null. */
export function extractOrderNumber(inv: StripeInvoiceLike): number | null {
  const md = inv.metadata ?? {};
  for (const key of ['order', 'order_ref', 'order_number', 'mason_order', 'mason_order_ref']) {
    const v = md[key];
    if (!v) continue;
    const m = String(v).match(ORD_RE);
    if (m) return Number(m[1]);
    if (/^\d{1,9}$/.test(String(v).trim())) return Number(String(v).trim());
  }
  for (const text of [inv.description, inv.footer]) {
    const m = text ? text.match(ORD_RE) : null;
    if (m) return Number(m[1]);
  }
  return null;
}

export function extractMasonInvoiceId(inv: StripeInvoiceLike): string | null {
  const md = inv.metadata ?? {};
  const v = md.mason_invoice_id || md.invoice_id;
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

export function normaliseEmail(e: string | null | undefined): string | null {
  const s = (e ?? '').trim().toLowerCase();
  return s || null;
}

export type OrderRef = { id: string; person_id: string | null; job_id: string | null; customer_name?: string | null };

export type MatchLookups = {
  invoiceExists: (masonInvoiceId: string) => Promise<boolean>;
  orderByNumber: (orderNumber: number) => Promise<OrderRef | null>;
  /** Open (non-archived) orders for any person in the org with this email. */
  openOrdersByEmail: (email: string) => Promise<OrderRef[]>;
};

export type MatchResult =
  | { kind: 'mason_invoice'; masonInvoiceId: string; reason: string }
  | { kind: 'order'; order: OrderRef; reason: string }
  | { kind: 'unmatched'; reason: string };

export async function matchStripeInvoice(inv: StripeInvoiceLike, l: MatchLookups): Promise<MatchResult> {
  const masonId = extractMasonInvoiceId(inv);
  if (masonId && (await l.invoiceExists(masonId))) {
    return { kind: 'mason_invoice', masonInvoiceId: masonId, reason: 'metadata.mason_invoice_id' };
  }
  const orderNumber = extractOrderNumber(inv);
  if (orderNumber != null) {
    const order = await l.orderByNumber(orderNumber);
    if (order) return { kind: 'order', order, reason: `order_ref ORD-${String(orderNumber).padStart(6, '0')}` };
  }
  const email = normaliseEmail(inv.customer_email ?? inv.metadata?.customer_email);
  if (email) {
    const orders = await l.openOrdersByEmail(email);
    if (orders.length === 1) return { kind: 'order', order: orders[0], reason: `email ${email} -> single open order` };
    if (orders.length > 1) return { kind: 'unmatched', reason: `email ${email}: ${orders.length} open orders` };
    return { kind: 'unmatched', reason: `email ${email}: no open order` };
  }
  return { kind: 'unmatched', reason: orderNumber != null ? `order ref ${orderNumber} not found` : 'no order ref or email' };
}

export type StripeInvoiceAmounts = {
  status?: string | null;
  total?: number | null;
  amount_paid?: number | null;
  amount_remaining?: number | null;
};

/** Mason invoices.status from a Stripe invoice status. */
export function masonStatusFromStripe(inv: StripeInvoiceAmounts): 'draft' | 'pending' | 'paid' | 'cancelled' {
  switch (inv.status) {
    case 'draft':
      return 'draft';
    case 'paid':
      return 'paid';
    case 'void':
    case 'uncollectible':
      return 'cancelled';
    default:
      return 'pending';
  }
}
