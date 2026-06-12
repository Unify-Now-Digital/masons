import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';
import {
  assertInvoiceBelongsToUrlOrg,
  constructOrgStripeEvent,
  createReconciliationStripeClient,
  getOrganizationStripeConfigRow,
  recordTestRoundTripIfEligible,
  resolvePaymentPath,
  serviceSupabase,
  type StripeCredentialMode,
} from '../_shared/stripeOrgCredentials.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, stripe-signature',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseOrganizationIdFromUrl(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('organization_id')?.trim();
    return id || null;
  } catch {
    return null;
  }
}

type SupabaseClient = ReturnType<typeof createClient>;

type WebhookContext = {
  urlOrganizationId: string;
  verifiedMode: StripeCredentialMode;
  event: Stripe.Event;
  supabase: SupabaseClient;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  const urlOrganizationId = parseOrganizationIdFromUrl(req);
  if (!urlOrganizationId) {
    return jsonResponse({ error: 'organization_id query parameter is required' }, 400);
  }

  const signature = req.headers.get('stripe-signature') ?? req.headers.get('Stripe-Signature');
  if (!signature) {
    return jsonResponse({ error: 'Missing Stripe-Signature' }, 400);
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    console.error('Failed to read webhook body', e);
    return jsonResponse({ error: 'Invalid body' }, 400);
  }

  const supabase = serviceSupabase();

  const orgConfig = await getOrganizationStripeConfigRow(supabase, urlOrganizationId);
  if (!orgConfig) {
    return jsonResponse({ error: 'Organization payment not configured' }, 404);
  }

  let event: Stripe.Event;
  let verifiedMode: StripeCredentialMode;
  try {
    const constructed = await constructOrgStripeEvent(
      rawBody,
      signature,
      urlOrganizationId,
      supabase,
    );
    event = constructed.event;
    verifiedMode = constructed.verifiedMode;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature';
    if (msg.includes('payment_not_configured')) {
      return jsonResponse({ error: 'Organization payment not configured' }, 404);
    }
    console.error('Stripe webhook signature verification failed:', {
      organization_id: urlOrganizationId,
      message: msg,
    });
    return jsonResponse({ error: 'Invalid signature' }, 400);
  }

  const ctx: WebhookContext = {
    urlOrganizationId,
    verifiedMode,
    event,
    supabase,
  };

  switch (event.type) {
    case 'checkout.session.completed':
      return await handleCheckoutSessionCompleted(ctx);
    case 'invoice.updated':
      return await handleInvoiceUpdated(ctx);
    case 'invoice.payment_succeeded':
      return await handleInvoicePaymentSucceeded(ctx);
    case 'invoice.paid':
      return await handleInvoicePaid(ctx);
    case 'invoice.payment_failed':
      return await handleInvoicePaymentFailed(ctx);
    case 'payment_intent.succeeded':
      return await handlePaymentIntentSucceeded(ctx);
    default:
      return jsonResponse({ received: true });
  }
});

// =========================================================
// Helpers
// =========================================================

async function syncInvoiceFromStripe(
  supabase: SupabaseClient,
  stripeInvoiceId: string,
  stripeInvoice: Stripe.Invoice,
): Promise<{
  invoiceId: string;
  userId: string | null;
  organizationId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeInvoiceIdCol: string | null;
} | null> {
  const { data: row } = await supabase
    .from('invoices')
    .select('id, user_id, organization_id, stripe_checkout_session_id, stripe_invoice_id')
    .eq('stripe_invoice_id', stripeInvoiceId)
    .single();

  if (!row) return null;

  const amountPaid = stripeInvoice.amount_paid ?? 0;
  const amountRemaining = stripeInvoice.amount_remaining ?? null;
  const updates: Record<string, unknown> = {
    stripe_invoice_status: (stripeInvoice.status ?? 'open') as string,
    amount_paid: amountPaid,
    amount_remaining: amountRemaining,
    hosted_invoice_url: stripeInvoice.hosted_invoice_url ?? null,
    updated_at: new Date().toISOString(),
  };
  if (amountPaid > 0) {
    updates.locked_at = new Date().toISOString();
  }

  await supabase.from('invoices').update(updates).eq('id', row.id);

  return {
    invoiceId: row.id,
    userId: row.user_id ?? null,
    organizationId: row.organization_id ?? null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
    stripeInvoiceIdCol: row.stripe_invoice_id ?? null,
  };
}

async function insertInvoicePaymentOnce(
  supabase: SupabaseClient,
  opts: {
    invoice_id: string;
    organization_id: string;
    user_id: string | null;
    stripe_invoice_id: string;
    stripe_payment_intent_id: string | null;
    stripe_charge_id: string | null;
    amount: number;
    status: string;
  },
): Promise<void> {
  const { error } = await supabase.from('invoice_payments').insert(opts);
  if (error) {
    if (error.code === '23505') return;
    console.error('invoice_payments insert error', error);
  }
}

function ignoreOrgMismatch(): Response {
  return jsonResponse({ received: true, ignored: 'org_mismatch' });
}

async function loadInvoiceByStripeId(
  supabase: SupabaseClient,
  stripeInvoiceId: string,
) {
  const { data } = await supabase
    .from('invoices')
    .select(
      'id, user_id, organization_id, status, stripe_status, stripe_invoice_status, amount_paid, stripe_checkout_session_id, stripe_invoice_id, stripe_credential_mode',
    )
    .eq('stripe_invoice_id', stripeInvoiceId)
    .maybeSingle();
  return data;
}

async function loadInvoiceByMasonId(supabase: SupabaseClient, masonInvoiceId: string) {
  const { data } = await supabase
    .from('invoices')
    .select(
      'id, user_id, organization_id, status, stripe_status, stripe_checkout_session_id, stripe_invoice_id, stripe_credential_mode',
    )
    .eq('id', masonInvoiceId)
    .maybeSingle();
  return data;
}

// =========================================================
// checkout.session.completed
// =========================================================
async function handleCheckoutSessionCompleted(ctx: WebhookContext): Promise<Response> {
  const { event, supabase, urlOrganizationId } = ctx;
  const session = event.data.object as Stripe.Checkout.Session;

  const meta = session.metadata || {};
  const stripeInvoiceIdFromMeta =
    (meta.stripe_invoice_id as string | undefined) ??
    (typeof session.payment_intent === 'object' &&
      (session.payment_intent as Stripe.PaymentIntent | null)?.metadata?.stripe_invoice_id
      ? ((session.payment_intent as Stripe.PaymentIntent).metadata.stripe_invoice_id as string)
      : undefined);

  if (stripeInvoiceIdFromMeta) {
    const invoiceRow = await loadInvoiceByStripeId(supabase, stripeInvoiceIdFromMeta);
    if (!invoiceRow) {
      return jsonResponse({ received: true });
    }
    if (invoiceRow.organization_id !== urlOrganizationId) {
      await assertInvoiceBelongsToUrlOrg(
        supabase,
        urlOrganizationId,
        invoiceRow.id,
        event,
      );
      return ignoreOrgMismatch();
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

    if (!paymentIntentId) {
      console.error('checkout.session.completed (partial): missing payment_intent');
      return jsonResponse({ received: true });
    }

    const credentialMode =
      (invoiceRow.stripe_credential_mode as StripeCredentialMode | null) ?? ctx.verifiedMode;

    let stripe: Stripe;
    try {
      ({ stripe } = await createReconciliationStripeClient(supabase, urlOrganizationId, credentialMode));
      await stripe.invoices.attachPayment(stripeInvoiceIdFromMeta, {
        payment_intent: paymentIntentId,
      });
    } catch (e) {
      console.error('Error attaching payment to invoice', e);
      return jsonResponse({ error: 'Failed to attach payment to invoice' }, 500);
    }
    const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceIdFromMeta);
    const synced = await syncInvoiceFromStripe(supabase, stripeInvoiceIdFromMeta, stripeInvoice);

    if (synced) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['charges'] });
      const amount = pi.amount_received ?? pi.amount ?? 0;
      const chargeId =
        pi.latest_charge
          ? (typeof pi.latest_charge === 'string'
              ? pi.latest_charge
              : (pi.latest_charge as Stripe.Charge).id)
          : null;

      await insertInvoicePaymentOnce(supabase, {
        invoice_id: synced.invoiceId,
        organization_id: urlOrganizationId,
        user_id: synced.userId,
        stripe_invoice_id: stripeInvoiceIdFromMeta,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId,
        amount,
        status: 'paid',
      });
    }

    return jsonResponse({ received: true });
  }

  let masonInvoiceId: string | null = (session.metadata?.invoice_id as string) ?? null;
  const paymentIntent = session.payment_intent;
  if (
    !masonInvoiceId &&
    paymentIntent &&
    typeof paymentIntent === 'object' &&
    (paymentIntent as Stripe.PaymentIntent).metadata?.invoice_id
  ) {
    masonInvoiceId = (paymentIntent as Stripe.PaymentIntent).metadata.invoice_id as string;
  }
  if (!masonInvoiceId) {
    console.error('checkout.session.completed: no invoice_id in metadata');
    return jsonResponse({ error: 'Missing invoice_id in session metadata' }, 400);
  }

  const existing = await loadInvoiceByMasonId(supabase, masonInvoiceId);
  if (!existing) {
    console.error('Webhook: invoice not found', masonInvoiceId);
    return jsonResponse({ error: 'Invoice not found' }, 404);
  }

  if (existing.organization_id !== urlOrganizationId) {
    await assertInvoiceBelongsToUrlOrg(supabase, urlOrganizationId, masonInvoiceId, event);
    return ignoreOrgMismatch();
  }

  const path = resolvePaymentPath(existing);
  if (path !== 'checkout') {
    return jsonResponse({ received: true });
  }

  if (existing.stripe_status === 'paid') {
    return jsonResponse({ received: true });
  }

  const paymentIntentId =
    typeof paymentIntent === 'string'
      ? paymentIntent
      : (paymentIntent as Stripe.PaymentIntent | null)?.id ?? null;

  // Capture the actually-paid amount. The checkout-session path doesn't go through
  // syncInvoiceFromStripe, so amount_paid was never written (stayed 0). Resolve it
  // from the session, falling back to the PaymentIntent's received amount.
  let paidAmount = typeof session.amount_total === 'number' ? session.amount_total : 0;
  let chargeId: string | null = null;
  if (paymentIntentId) {
    try {
      const credentialMode =
        (existing.stripe_credential_mode as StripeCredentialMode | null) ?? ctx.verifiedMode;
      const { stripe } = await createReconciliationStripeClient(
        supabase,
        urlOrganizationId,
        credentialMode,
      );
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      paidAmount = pi.amount_received ?? pi.amount ?? paidAmount;
      chargeId = pi.latest_charge
        ? (typeof pi.latest_charge === 'string'
            ? pi.latest_charge
            : (pi.latest_charge as Stripe.Charge).id)
        : null;
    } catch (e) {
      console.error('checkout.session.completed: failed to resolve PI amount; using session.amount_total', e);
    }
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    stripe_status: 'paid',
    paid_at: now,
    status: 'paid',
    updated_at: now,
    payment_date: now.slice(0, 10),
    payment_method: 'Stripe',
    amount_paid: paidAmount,
    amount_remaining: 0,
    locked_at: now,
  };
  if (paymentIntentId) updates.stripe_payment_intent_id = paymentIntentId;
  if (session.id) updates.stripe_checkout_session_id = session.id;

  const { error: updateErr } = await supabase.from('invoices').update(updates).eq('id', masonInvoiceId);

  if (updateErr) {
    console.error('Failed to update invoice to paid', updateErr);
    return jsonResponse({ error: 'Failed to update invoice' }, 500);
  }

  if (paidAmount > 0) {
    const { error: payErr } = await supabase.from('invoice_payments').insert({
      invoice_id: masonInvoiceId,
      user_id: existing.user_id ?? null,
      organization_id: urlOrganizationId,
      stripe_invoice_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      amount: paidAmount,
      status: 'paid',
    });
    if (payErr && payErr.code !== '23505') {
      console.error('invoice_payments insert error (checkout path)', payErr);
    }
  }

  await recordTestRoundTripIfEligible(supabase, urlOrganizationId, event.livemode);

  return jsonResponse({ received: true });
}

// =========================================================
// invoice.updated — sync only
// =========================================================
async function handleInvoiceUpdated(ctx: WebhookContext): Promise<Response> {
  const stripeInvoice = ctx.event.data.object as Stripe.Invoice;
  const stripeInvoiceId = stripeInvoice.id;
  if (!stripeInvoiceId) return jsonResponse({ received: true });

  const row = await loadInvoiceByStripeId(ctx.supabase, stripeInvoiceId);
  if (!row) return jsonResponse({ received: true });
  if (row.organization_id !== ctx.urlOrganizationId) {
    await assertInvoiceBelongsToUrlOrg(ctx.supabase, ctx.urlOrganizationId, row.id, ctx.event);
    return ignoreOrgMismatch();
  }

  await syncInvoiceFromStripe(ctx.supabase, stripeInvoiceId, stripeInvoice);
  return jsonResponse({ received: true });
}

// =========================================================
// invoice.payment_succeeded — sync only, no status=paid
// =========================================================
async function handleInvoicePaymentSucceeded(ctx: WebhookContext): Promise<Response> {
  const stripeInvoice = ctx.event.data.object as Stripe.Invoice;
  const stripeInvoiceId = stripeInvoice.id;
  if (!stripeInvoiceId) return jsonResponse({ received: true });

  const row = await loadInvoiceByStripeId(ctx.supabase, stripeInvoiceId);
  if (!row) {
    console.warn('invoice.payment_succeeded: no Mason invoice for', stripeInvoiceId);
    return jsonResponse({ received: true });
  }
  if (row.organization_id !== ctx.urlOrganizationId) {
    await assertInvoiceBelongsToUrlOrg(ctx.supabase, ctx.urlOrganizationId, row.id, ctx.event);
    return ignoreOrgMismatch();
  }

  const newAmountPaid = stripeInvoice.amount_paid ?? 0;
  const previousAmountPaid = Number(row.amount_paid ?? 0);
  const paymentAmount = newAmountPaid - previousAmountPaid;

  await syncInvoiceFromStripe(ctx.supabase, stripeInvoiceId, stripeInvoice);

  if (paymentAmount > 0) {
    const paymentIntentId =
      typeof stripeInvoice.payment_intent === 'string'
        ? stripeInvoice.payment_intent
        : (stripeInvoice.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;
    const chargeId =
      typeof stripeInvoice.charge === 'string'
        ? stripeInvoice.charge
        : (stripeInvoice.charge as Stripe.Charge | null)?.id ?? null;

    await insertInvoicePaymentOnce(ctx.supabase, {
      invoice_id: row.id,
      organization_id: ctx.urlOrganizationId,
      user_id: row.user_id ?? null,
      stripe_invoice_id: stripeInvoiceId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      amount: paymentAmount,
      status: 'paid',
    });
  }

  return jsonResponse({ received: true });
}

// =========================================================
// invoice.paid — authoritative for hosted path
// =========================================================
async function handleInvoicePaid(ctx: WebhookContext): Promise<Response> {
  const stripeInvoice = ctx.event.data.object as Stripe.Invoice;
  const stripeInvoiceId = stripeInvoice.id;

  if (!stripeInvoiceId) {
    console.error('invoice.paid: missing invoice id');
    return jsonResponse({ error: 'Missing Stripe invoice id' }, 400);
  }

  const existing = await loadInvoiceByStripeId(ctx.supabase, stripeInvoiceId);
  if (!existing) {
    console.warn('invoice.paid: no Mason invoice for Stripe invoice', stripeInvoiceId);
    return jsonResponse({ received: true });
  }

  if (existing.organization_id !== ctx.urlOrganizationId) {
    await assertInvoiceBelongsToUrlOrg(ctx.supabase, ctx.urlOrganizationId, existing.id, ctx.event);
    return ignoreOrgMismatch();
  }

  const path = resolvePaymentPath(existing);
  if (path !== 'hosted') {
    return jsonResponse({ received: true });
  }

  const now = new Date().toISOString();
  const paymentIntentId =
    typeof stripeInvoice.payment_intent === 'string'
      ? stripeInvoice.payment_intent
      : (stripeInvoice.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;
  const chargeId =
    typeof stripeInvoice.charge === 'string'
      ? stripeInvoice.charge
      : (stripeInvoice.charge as Stripe.Charge | null)?.id ?? null;

  const updates: Record<string, unknown> = {
    status: 'paid',
    stripe_status: 'paid',
    stripe_invoice_status: 'paid',
    amount_paid: stripeInvoice.amount_paid ?? 0,
    amount_remaining: stripeInvoice.amount_remaining ?? 0,
    hosted_invoice_url: stripeInvoice.hosted_invoice_url ?? null,
    paid_at: now,
    payment_date: now.slice(0, 10),
    payment_method: 'Stripe',
    updated_at: now,
    locked_at: now,
  };
  if (paymentIntentId) updates.stripe_payment_intent_id = paymentIntentId;

  const { error: updateErr } = await ctx.supabase
    .from('invoices')
    .update(updates)
    .eq('id', existing.id);

  if (updateErr) {
    console.error('invoice.paid: failed to update Mason invoice', updateErr);
    return jsonResponse({ error: 'Failed to update invoice' }, 500);
  }

  const totalPaid = stripeInvoice.amount_paid ?? 0;
  const previousAmountPaid = Number(existing.amount_paid ?? 0);
  const paymentAmount = totalPaid - previousAmountPaid;
  if (paymentAmount > 0) {
    await insertInvoicePaymentOnce(ctx.supabase, {
      invoice_id: existing.id,
      organization_id: ctx.urlOrganizationId,
      user_id: existing.user_id ?? null,
      stripe_invoice_id: stripeInvoiceId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      amount: paymentAmount,
      status: 'paid',
    });
  }

  await recordTestRoundTripIfEligible(ctx.supabase, ctx.urlOrganizationId, ctx.event.livemode);

  return jsonResponse({ received: true });
}

// =========================================================
// invoice.payment_failed
// =========================================================
async function handleInvoicePaymentFailed(ctx: WebhookContext): Promise<Response> {
  const stripeInvoice = ctx.event.data.object as Stripe.Invoice;
  const stripeInvoiceId = stripeInvoice.id;

  if (!stripeInvoiceId) {
    console.error('invoice.payment_failed: missing invoice id');
    return jsonResponse({ error: 'Missing Stripe invoice id' }, 400);
  }

  const existing = await loadInvoiceByStripeId(ctx.supabase, stripeInvoiceId);
  if (!existing) {
    console.warn('invoice.payment_failed: no Mason invoice for Stripe invoice', stripeInvoiceId);
    return jsonResponse({ received: true });
  }

  if (existing.organization_id !== ctx.urlOrganizationId) {
    await assertInvoiceBelongsToUrlOrg(ctx.supabase, ctx.urlOrganizationId, existing.id, ctx.event);
    return ignoreOrgMismatch();
  }

  const { error: updateErr } = await ctx.supabase
    .from('invoices')
    .update({
      stripe_invoice_status: 'payment_failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (updateErr) {
    console.error('invoice.payment_failed: failed to update Mason invoice', updateErr);
    return jsonResponse({ error: 'Failed to update invoice' }, 500);
  }

  return jsonResponse({ received: true });
}

// =========================================================
// payment_intent.succeeded — no paid-state side effects (FR-014c)
// =========================================================
async function handlePaymentIntentSucceeded(ctx: WebhookContext): Promise<Response> {
  return jsonResponse({ received: true });
}
