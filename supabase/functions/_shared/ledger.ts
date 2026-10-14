// Pure mappers from provider payloads to the ledger ingest JSON accepted by
// public.ledger_ingest_payment (service role only). No secrets, no I/O here.

export type LedgerSource = 'stripe' | 'revolut' | 'manual';
export type LedgerKind = 'payment' | 'refund' | 'chargeback' | 'chargeback_reversal' | 'fee_adjustment';

export interface LedgerIngest {
  organization_id: string;
  source: LedgerSource;
  external_id: string;
  kind?: LedgerKind;
  parent_external_id?: string | null;
  state?: 'pending' | 'completed' | 'reverted';
  gross_pence: number;
  fee_pence?: number;
  currency?: string;
  received_at: string;
  payer_name?: string | null;
  payer_email?: string | null;
  reference?: string | null;
  method?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_invoice_id?: string | null;
  raw?: unknown;
}

/** Revolut amounts are major units (pounds); convert without float drift. */
export function poundsToPence(amount: number): number {
  return Math.round(Number((amount * 100).toFixed(4)));
}

// --- Revolut ----------------------------------------------------------------
export interface RevolutTransaction {
  id: string;
  type?: string;
  state: string;
  reference?: string;
  legs?: Array<{ amount: number; currency?: string; description?: string; counterparty?: { name?: string } }>;
  created_at: string;
  completed_at?: string;
}

export function revolutState(state: string): 'pending' | 'completed' | 'reverted' {
  if (state === 'completed') return 'completed';
  if (state === 'reverted' || state === 'declined' || state === 'failed') return 'reverted';
  return 'pending';
}

/** Incoming Revolut transfer → ingest JSON. Outgoing/zero legs return null (not money in). */
export function mapRevolutTransaction(orgId: string, txn: RevolutTransaction, raw?: unknown): LedgerIngest | null {
  const leg = txn.legs?.[0];
  if (!leg || !(leg.amount > 0)) return null;
  return {
    organization_id: orgId,
    source: 'revolut',
    external_id: txn.id,
    kind: 'payment',
    state: revolutState(txn.state),
    gross_pence: poundsToPence(leg.amount),
    fee_pence: 0,
    currency: (leg.currency ?? 'GBP').toLowerCase(),
    received_at: txn.completed_at ?? txn.created_at,
    payer_name: leg.counterparty?.name ?? null,
    reference: txn.reference ?? leg.description ?? null,
    method: 'bank_transfer',
    raw: raw ?? txn,
  };
}

// --- Revolut webhook signature (Business API) --------------------------------
// Signed payload: `v1.{Revolut-Request-Timestamp}.{raw body}`, HMAC-SHA256 with the
// webhook signing secret, header `Revolut-Signature: v1=<hex>[,v1=<hex>…]` (several during
// secret rotation). Timestamp is a UNIX epoch in milliseconds.
export const REVOLUT_MAX_AGE_MS = 5 * 60 * 1000;

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function revolutSignature(secret: string, timestamp: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return 'v1=' + hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`v1.${timestamp}.${rawBody}`)));
}

export async function verifyRevolutSignature(opts: {
  secret: string; timestamp: string | null; signatureHeader: string | null; rawBody: string; now?: number; maxAgeMs?: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const { secret, timestamp, signatureHeader, rawBody } = opts;
  if (!secret) return { ok: false, reason: 'no secret' };
  if (!timestamp || !/^\d{10,16}$/.test(timestamp)) return { ok: false, reason: 'bad timestamp' };
  const age = Math.abs((opts.now ?? Date.now()) - Number(timestamp));
  if (age > (opts.maxAgeMs ?? REVOLUT_MAX_AGE_MS)) return { ok: false, reason: 'stale timestamp' };
  if (!signatureHeader) return { ok: false, reason: 'missing signature' };
  const expected = await revolutSignature(secret, timestamp, rawBody);
  const ok = signatureHeader.split(',').map((s) => s.trim()).some((s) => timingSafeEqual(s, expected));
  return ok ? { ok } : { ok, reason: 'signature mismatch' };
}

// --- Stripe -----------------------------------------------------------------
// Ledger rows are keyed on the charge (one row per money movement); payment intent and
// invoice ids are carried for linking. Fee comes from the expanded balance_transaction.
interface StripeBalanceTxn { fee?: number }
export interface StripeChargeLike {
  id: string;
  amount: number;
  amount_captured?: number;
  currency: string;
  created: number;
  status?: string;
  paid?: boolean;
  payment_intent?: string | { id: string } | null;
  invoice?: string | { id: string } | null;
  balance_transaction?: string | StripeBalanceTxn | null;
  billing_details?: { name?: string | null; email?: string | null } | null;
  receipt_email?: string | null;
  description?: string | null;
  payment_method_details?: { type?: string } | null;
  metadata?: Record<string, string>;
}

const idOf = (v: string | { id: string } | null | undefined) => (v == null ? null : typeof v === 'string' ? v : v.id);

export function mapStripeCharge(orgId: string, ch: StripeChargeLike, extra: { stripeInvoiceId?: string | null; raw?: unknown } = {}): LedgerIngest {
  const bt = typeof ch.balance_transaction === 'object' && ch.balance_transaction ? ch.balance_transaction : null;
  return {
    organization_id: orgId,
    source: 'stripe',
    external_id: ch.id,
    kind: 'payment',
    state: ch.status === 'succeeded' || ch.paid ? 'completed' : ch.status === 'failed' ? 'reverted' : 'pending',
    gross_pence: ch.amount_captured ?? ch.amount,
    fee_pence: bt?.fee ?? 0,
    currency: ch.currency,
    received_at: new Date(ch.created * 1000).toISOString(),
    payer_name: ch.billing_details?.name ?? null,
    payer_email: ch.billing_details?.email ?? ch.receipt_email ?? null,
    reference: ch.description ?? ch.metadata?.invoice_number ?? null,
    method: ch.payment_method_details?.type ?? 'card',
    stripe_payment_intent_id: idOf(ch.payment_intent),
    stripe_invoice_id: extra.stripeInvoiceId ?? idOf(ch.invoice),
    raw: extra.raw,
  };
}

export interface StripeRefundLike { id: string; amount: number; currency: string; created: number; status?: string; charge?: string | { id: string } | null; payment_intent?: string | { id: string } | null }

export function mapStripeRefund(orgId: string, r: StripeRefundLike, raw?: unknown): LedgerIngest {
  return {
    organization_id: orgId, source: 'stripe', external_id: r.id, kind: 'refund',
    parent_external_id: idOf(r.charge),
    state: r.status === 'succeeded' ? 'completed' : r.status === 'failed' || r.status === 'canceled' ? 'reverted' : 'pending',
    gross_pence: -Math.abs(r.amount), fee_pence: 0, currency: r.currency,
    received_at: new Date(r.created * 1000).toISOString(),
    stripe_payment_intent_id: idOf(r.payment_intent), method: 'card', raw,
  };
}

export interface StripeDisputeLike { id: string; amount: number; currency: string; created: number; status?: string; charge?: string | { id: string } | null; payment_intent?: string | { id: string } | null }

export function mapStripeDispute(orgId: string, d: StripeDisputeLike, raw?: unknown): LedgerIngest {
  // Opening a dispute takes the money back (negative chargeback row). A dispute the merchant
  // wins returns it: a separate positive chargeback_reversal row (never an edit).
  const won = d.status === 'won';
  return {
    organization_id: orgId, source: 'stripe',
    external_id: won ? `${d.id}:reversal` : d.id,
    kind: won ? 'chargeback_reversal' : 'chargeback',
    parent_external_id: idOf(d.charge),
    state: 'completed',
    gross_pence: won ? Math.abs(d.amount) : -Math.abs(d.amount), fee_pence: 0, currency: d.currency,
    received_at: new Date(d.created * 1000).toISOString(),
    stripe_payment_intent_id: idOf(d.payment_intent), method: 'card', raw,
  };
}
