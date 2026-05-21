import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!webhookSecret || !stripeSecret) {
    console.error('STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY not set');
    return jsonResponse({ error: 'Webhook not configured' }, 500);
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

  const stripe = new Stripe(stripeSecret);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature';
    console.error('Stripe webhook signature verification failed:', msg);
    return jsonResponse({ error: 'Invalid signature' }, 400);
  }

  // --- Supabase client (shared across handlers) ---
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase URL or SERVICE_ROLE_KEY missing');
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // =========================================================
  // Event routing
  // =========================================================

  switch (event.type) {
    // ----- Legacy: Stripe Checkout flow -----
    case 'checkout.session.completed': {
      return await handleCheckoutSessionCompleted(event, stripe, supabase);
    }

    // ----- Stripe Invoicing API: partial payments + sync -----
    case 'invoice.updated': {
      return await handleInvoiceUpdated(event, supabase);
    }

    case 'invoice.payment_succeeded': {
      return await handleInvoicePaymentSucceeded(event, supabase);
    }

    case 'invoice.paid': {
      return await handleInvoicePaid(event, supabase);
    }

    case 'invoice.payment_failed': {
      return await handleInvoicePaymentFailed(event, supabase);
    }

    case 'payment_intent.succeeded': {
      return await handlePaymentIntentSucceeded(event, supabase);
    }

    default: {
      return jsonResponse({ received: true });
    }
  }
});

// =========================================================
// Helpers: sync Mason invoice from Stripe Invoice; insert payment (idempotent)
// =========================================================

type SupabaseClient = ReturnType<typeof createClient>;

async function syncInvoiceFromStripe(
  supabase: SupabaseClient,
  stripeInvoiceId: string,
  stripeInvoice: Stripe.Invoice
): Promise<{ invoiceId: string; userId: string | null } | null> {
  const { data: row } = await supabase
    .from('invoices')
    .select('id, user_id')
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
    (updates as Record<string, unknown>).locked_at = new Date().toISOString();
  }

  await supabase.from('invoices').update(updates).eq('id', row.id);
  return { invoiceId: row.id, userId: row.user_id ?? null };
}

async function insertInvoicePaymentOnce(
  supabase: SupabaseClient,
  opts: {
    invoice_id: string;
    user_id: string | null;
    stripe_invoice_id: string;
    stripe_payment_intent_id: string | null;
    stripe_charge_id: string | null;
    amount: number;
    status: string;
  }
): Promise<void> {
  const { invoice_id, user_id, stripe_invoice_id, stripe_payment_intent_id, stripe_charge_id, amount, status } = opts;
  const { error } = await supabase.from('invoice_payments').insert({
    invoice_id,
    user_id,
    stripe_invoice_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    amount,
    status,
  });
  if (error) {
    if (error.code === '23505') return; // unique violation = idempotent, already inserted
    console.error('invoice_payments insert error', error);
  }
}

// =========================================================
// Handler: checkout.session.completed
// - Legacy flow (invoice_id metadata)
// - New partial-payment Checkout flow (stripe_invoice_id metadata)
// =========================================================
async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: SupabaseClient
): Promise<Response> {
  const session = event.data.object as Stripe.Checkout.Session;

  const meta = session.metadata || {};
  const stripeInvoiceId =
    (meta.stripe_invoice_id as string | undefined) ??
    (typeof session.payment_intent === 'object' &&
      (session.payment_intent as Stripe.PaymentIntent | null)?.metadata?.stripe_invoice_id
      ? ((session.payment_intent as Stripe.PaymentIntent).metadata
          .stripe_invoice_id as string)
      : undefined);

  // New partial-payment flow: session is linked to an existing Stripe invoice
  if (stripeInvoiceId) {
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

    if (!paymentIntentId) {
      console.error('checkout.session.completed (partial): missing payment_intent');
      return jsonResponse({ received: true });
    }

    // Attach payment to invoice via Stripe REST API so Stripe applies it as a partial payment
    try {
      const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeSecret) {
        console.error('STRIPE_SECRET_KEY not set when attaching payment to invoice');
        return jsonResponse({ error: 'Webhook not configured' }, 500);
      }

      const resp = await fetch(
        `https://api.stripe.com/v1/invoices/${encodeURIComponent(stripeInvoiceId)}/attach_payment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ payment_intent: paymentIntentId }),
        },
      );

      if (!resp.ok) {
        const text = await resp.text();
        console.error('Failed to attach payment to invoice', {
          status: resp.status,
          body: text,
        });
        return jsonResponse({ error: 'Failed to attach payment to invoice' }, 500);
      }
    } catch (e) {
      console.error('Error calling Stripe attach_payment endpoint', e);
      return jsonResponse({ error: 'Failed to attach payment to invoice' }, 500);
    }

    // Retrieve updated Stripe invoice and sync Mason invoice
    const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId);
    const synced = await syncInvoiceFromStripe(supabase, stripeInvoiceId, stripeInvoice);

    if (synced) {
      const { invoiceId, userId } = synced;
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['charges'],
      });
      const amount = pi.amount_received ?? pi.amount ?? 0;
      const chargeId =
        pi.latest_charge
          ? (typeof pi.latest_charge === 'string'
              ? pi.latest_charge
              : (pi.latest_charge as Stripe.Charge).id)
          : null;

      await insertInvoicePaymentOnce(supabase, {
        invoice_id: invoiceId,
        user_id: userId,
        stripe_invoice_id: stripeInvoiceId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId,
        amount,
        status: 'paid',
      });
    }

    return jsonResponse({ received: true });
  }

  // Legacy Checkout flow: preserve existing behavior using invoice_id metadata
  let invoiceId: string | null = (session.metadata?.invoice_id as string) ?? null;
  const paymentIntent = session.payment_intent;
  if (
    !invoiceId &&
    paymentIntent &&
    typeof paymentIntent === 'object' &&
    (paymentIntent as Stripe.PaymentIntent).metadata?.invoice_id
  ) {
    invoiceId = (paymentIntent as Stripe.PaymentIntent).metadata
      .invoice_id as string;
  }
  if (!invoiceId) {
    console.error('checkout.session.completed: no invoice_id in metadata');
    return jsonResponse({ error: 'Missing invoice_id in session metadata' }, 400);
  }

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, stripe_status')
    .eq('id', invoiceId)
    .single();

  if (!existing) {
    console.error('Webhook: invoice not found', invoiceId);
    return jsonResponse({ error: 'Invoice not found' }, 404);
  }

  if (existing.stripe_status === 'paid') {
    return jsonResponse({ received: true });
  }

  const paymentIntentId =
    typeof paymentIntent === 'string'
      ? paymentIntent
      : (paymentIntent as Stripe.PaymentIntent | null)?.id ?? null;

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    stripe_status: 'paid',
    paid_at: now,
    status: 'paid',
    updated_at: now,
    payment_date: now.slice(0, 10),
    payment_method: 'Stripe',
  };
  if (paymentIntentId) updates.stripe_payment_intent_id = paymentIntentId;
  if (session.id) updates.stripe_checkout_session_id = session.id;

  const { error: updateErr } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', invoiceId);

  if (updateErr) {
    console.error('Failed to update invoice to paid', updateErr);
    return jsonResponse({ error: 'Failed to update invoice' }, 500);
  }

  return jsonResponse({ received: true });
}

// =========================================================
// Handler: invoice.updated (sync status/amounts/url; set locked when amount_paid > 0)
// =========================================================
async function handleInvoiceUpdated(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<Response> {
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const stripeInvoiceId = stripeInvoice.id;
  if (!stripeInvoiceId) return jsonResponse({ received: true });

  await syncInvoiceFromStripe(supabase, stripeInvoiceId, stripeInvoice);
  return jsonResponse({ received: true });
}

// =========================================================
// Handler: invoice.payment_succeeded (partial or full payment applied)
// =========================================================
async function handleInvoicePaymentSucceeded(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<Response> {
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const stripeInvoiceId = stripeInvoice.id;
  if (!stripeInvoiceId) return jsonResponse({ received: true });

  const { data: row } = await supabase
    .from('invoices')
    .select('id, user_id, amount_paid')
    .eq('stripe_invoice_id', stripeInvoiceId)
    .single();

  if (!row) {
    console.warn('invoice.payment_succeeded: no Mason invoice for', stripeInvoiceId);
    return jsonResponse({ received: true });
  }

  const newAmountPaid = stripeInvoice.amount_paid ?? 0;
  const previousAmountPaid = Number(row.amount_paid ?? 0);
  const paymentAmount = newAmountPaid - previousAmountPaid;

  await syncInvoiceFromStripe(supabase, stripeInvoiceId, stripeInvoice);

  if (paymentAmount > 0) {
    const paymentIntentId =
      typeof stripeInvoice.payment_intent === 'string'
        ? stripeInvoice.payment_intent
        : (stripeInvoice.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;
    const chargeId =
      typeof stripeInvoice.charge === 'string'
        ? stripeInvoice.charge
        : (stripeInvoice.charge as Stripe.Charge | null)?.id ?? null;

    await insertInvoicePaymentOnce(supabase, {
      invoice_id: row.id,
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
// Handler: invoice.paid (Stripe Invoicing API — fully paid)
// =========================================================
async function handleInvoicePaid(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<Response> {
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const stripeInvoiceId = stripeInvoice.id;

  if (!stripeInvoiceId) {
    console.error('invoice.paid: missing invoice id');
    return jsonResponse({ error: 'Missing Stripe invoice id' }, 400);
  }

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, user_id, status, stripe_invoice_status, amount_paid')
    .eq('stripe_invoice_id', stripeInvoiceId)
    .single();

  if (!existing) {
    console.warn('invoice.paid: no Mason invoice for Stripe invoice', stripeInvoiceId);
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
  if (paymentIntentId) (updates as Record<string, unknown>).stripe_payment_intent_id = paymentIntentId;

  const { error: updateErr } = await supabase
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
    await insertInvoicePaymentOnce(supabase, {
      invoice_id: existing.id,
      user_id: existing.user_id ?? null,
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
// Handler: invoice.payment_failed (Stripe Invoicing API)
// =========================================================
async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<Response> {
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const stripeInvoiceId = stripeInvoice.id;

  if (!stripeInvoiceId) {
    console.error('invoice.payment_failed: missing invoice id');
    return jsonResponse({ error: 'Missing Stripe invoice id' }, 400);
  }

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, stripe_invoice_status')
    .eq('stripe_invoice_id', stripeInvoiceId)
    .single();

  if (!existing) {
    console.warn('invoice.payment_failed: no Mason invoice for Stripe invoice', stripeInvoiceId);
    return jsonResponse({ received: true });
  }

  const { error: updateErr } = await supabase
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
// Handler: payment_intent.succeeded (fallback when invoice events missing)
// =========================================================
async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<Response> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const invoiceId = typeof paymentIntent.invoice === 'string'
    ? paymentIntent.invoice
    : (paymentIntent.invoice as Stripe.Invoice | null)?.id ?? null;
  if (!invoiceId) return jsonResponse({ received: true });

  const { data: row } = await supabase
    .from('invoices')
    .select('id, user_id, amount_paid')
    .eq('stripe_invoice_id', invoiceId)
    .single();

  if (!row) return jsonResponse({ received: true });

  const amount = paymentIntent.amount_received ?? paymentIntent.amount ?? 0;
  const chargeId =
    paymentIntent.latest_charge
      ? (typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : (paymentIntent.latest_charge as Stripe.Charge).id)
      : null;

  await insertInvoicePaymentOnce(supabase, {
    invoice_id: row.id,
    user_id: row.user_id ?? null,
    stripe_invoice_id: invoiceId,
    stripe_payment_intent_id: paymentIntent.id,
    stripe_charge_id: chargeId,
    amount,
    status: 'paid',
  });

  return jsonResponse({ received: true });
}
