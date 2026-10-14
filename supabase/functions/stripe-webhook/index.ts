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
import { mapStripeCharge, mapStripeDispute, mapStripeRefund, type LedgerIngest } from '../_shared/ledger.ts';

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
    case 'checkout.session.expired':
      return await handleCheckoutSessionExpired(ctx);
    case 'invoice.updated':
      return await handleInvoiceUpdated(ctx);
    case 'invoice.voided':
    case 'invoice.marked_uncollectible':
      // F-022: these carry the full invoice with its terminal status; without them
      // Mason's void state depended solely on invoice.updated being delivered, and
      // the C4/F-017 void guard read stale 'open'. Same org-guarded sync path.
      return await handleInvoiceUpdated(ctx);
    case 'invoice.payment_succeeded':
      return await handleInvoicePaymentSucceeded(ctx);
    case 'invoice.paid':
      return await handleInvoicePaid(ctx);
    case 'invoice.payment_failed':
      return await handleInvoicePaymentFailed(ctx);
    case 'payment_intent.succeeded':
      return await handlePaymentIntentSucceeded(ctx);
    case 'charge.refunded':
    case 'charge.refund.updated':
      return await handleChargeRefunded(ctx);
    case 'charge.dispute.created':
    case 'charge.dispute.closed':
      return await handleChargeDispute(ctx);
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

  // amount_paid / amount_remaining / status are derived from the payments ledger
  // (public.ledger_refresh_invoice); this only mirrors Stripe's own invoice state.
  const amountPaid = stripeInvoice.amount_paid ?? 0;
  const updates: Record<string, unknown> = {
    stripe_invoice_status: (stripeInvoice.status ?? 'open') as string,
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

/**
 * Record a Stripe payment in the unified ledger (public.ledger_ingest_payment, service role).
 * Keyed on the charge id; the fee comes from the charge's balance transaction. Matching to the
 * Mason invoice happens in the DB via the Stripe invoice / payment-intent link (auto-confirmed).
 * Idempotent: Stripe retries and duplicate events upsert the same row.
 */
async function ingestStripePayment(
  supabase: SupabaseClient,
  opts: {
    organization_id: string;
    stripe: Stripe | null;
    stripe_invoice_id: string | null;
    stripe_payment_intent_id: string | null;
    stripe_charge_id: string | null;
    amount: number;
    reference?: string | null;
  },
): Promise<boolean> {
  let row: LedgerIngest | null = null;
  if (opts.stripe && (opts.stripe_charge_id || opts.stripe_payment_intent_id)) {
    try {
      let chargeId = opts.stripe_charge_id;
      if (!chargeId && opts.stripe_payment_intent_id) {
        const pi = await opts.stripe.paymentIntents.retrieve(opts.stripe_payment_intent_id);
        chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null;
      }
      if (chargeId) {
        const ch = await opts.stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] });
        row = mapStripeCharge(opts.organization_id, ch as unknown as Parameters<typeof mapStripeCharge>[1], {
          stripeInvoiceId: opts.stripe_invoice_id,
          raw: { charge_id: ch.id, payment_intent: opts.stripe_payment_intent_id, invoice: opts.stripe_invoice_id },
        });
      }
    } catch (e) {
      console.error('ledger: could not expand Stripe charge; recording without fee', e instanceof Error ? e.message : e);
    }
  }
  if (!row) {
    const externalId = opts.stripe_charge_id ?? opts.stripe_payment_intent_id;
    if (!externalId) {
      console.error('ledger: Stripe payment without charge or payment intent id — not recorded');
      return false;
    }
    row = {
      organization_id: opts.organization_id, source: 'stripe', external_id: externalId, kind: 'payment',
      state: 'completed', gross_pence: opts.amount, fee_pence: 0, currency: 'gbp', received_at: new Date().toISOString(),
      method: 'card', stripe_payment_intent_id: opts.stripe_payment_intent_id, stripe_invoice_id: opts.stripe_invoice_id,
    };
  }
  if (opts.reference) row.reference = opts.reference;
  const { error } = await supabase.rpc('ledger_ingest_payment', { p: row });
  if (error) {
    console.error('ledger_ingest_payment failed', error.code, error.message);
    return false;
  }
  return true;
}

async function stripeForOrg(ctx: WebhookContext, mode?: StripeCredentialMode | null): Promise<Stripe | null> {
  try {
    return (await createReconciliationStripeClient(ctx.supabase, ctx.urlOrganizationId, mode ?? ctx.verifiedMode)).stripe;
  } catch (e) {
    console.error('ledger: no Stripe client for org', e instanceof Error ? e.message : e);
    return null;
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
      'id, user_id, organization_id, status, stripe_status, stripe_invoice_status, amount_paid, stripe_checkout_session_id, stripe_invoice_id, stripe_credential_mode, deleted_at',
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

    // --- Void guard (F-017): never attach a payment to a dead invoice. Without this the
    //     attach throws -> 500 -> Stripe retries forever: customer charged, nothing
    //     recorded, no alert. Record the orphan visibly (invoice_payments row with a
    //     non-'paid' status, so it renders in the sidebar but is excluded from every
    //     money metric and the is_customer trigger) and return 200 so Stripe stops
    //     retrying; reconciliation is manual (refund or re-invoice). ---
    const invoiceDead =
      ['void', 'uncollectible'].includes(
        ((invoiceRow.stripe_invoice_status as string | null) ?? '').toString(),
      ) || Boolean(invoiceRow.deleted_at);
    if (invoiceDead) {
      const orphanAmount = typeof session.amount_total === 'number' ? session.amount_total : 0;
      console.error(
        JSON.stringify({
          level: 'error',
          alert: 'stripe_orphaned_partial_payment',
          message:
            'Partial-link payment completed against a void/deleted invoice — NOT attached; reconcile manually (refund or re-invoice)',
          mason_invoice_id: invoiceRow.id,
          organization_id: urlOrganizationId,
          stripe_invoice_id: stripeInvoiceIdFromMeta,
          checkout_session_id: session.id,
          payment_intent_id: paymentIntentId,
          amount: orphanAmount,
          stripe_invoice_status: invoiceRow.stripe_invoice_status ?? null,
          deleted_at: invoiceRow.deleted_at ?? null,
        }),
      );await ingestStripePayment(supabase, {
        organization_id: urlOrganizationId,
        stripe: null,
        // Deliberately NOT linked to the dead invoice: lands in Needs review for a person.
        stripe_invoice_id: null,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: null,
        amount: orphanAmount,
        reference: `Paid against void/deleted invoice ${invoiceRow.id} — refund or re-invoice`,
      });
      return jsonResponse({ received: true, orphaned: true });
    }

    const credentialMode =
      (invoiceRow.stripe_credential_mode as StripeCredentialMode | null) ?? ctx.verifiedMode;

    let stripe: Stripe;
    try {
      const reconciliation = await createReconciliationStripeClient(
        supabase,
        urlOrganizationId,
        credentialMode,
      );
      stripe = reconciliation.stripe;

      // F-020: npm:stripe@14.21.0 has no invoices.attachPayment (method list ends at
      // voidInvoice), so call the endpoint directly — form-encoded POST per Stripe
      // conventions; param name is payment_intent (API ref:
      // POST /v1/invoices/{invoice}/attach_payment). A non-200 here is a real failure:
      // log structured and return 500 so Stripe retries, exactly as before.
      const attachRes = await fetch(
        `https://api.stripe.com/v1/invoices/${encodeURIComponent(stripeInvoiceIdFromMeta)}/attach_payment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${reconciliation.credentials.secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ payment_intent: paymentIntentId }).toString(),
        },
      );
      if (!attachRes.ok) {
        const errBody = await attachRes.text();

        // Belt-and-braces (C7): if the attach was refused because the Stripe invoice is
        // no longer open (voided/uncollectible — e.g. a Dashboard void whose webhook
        // never reached Mason), retrying can never succeed: this is the F-017 orphan
        // case. Classify by live retrieve, not error-message parsing — evidence-based,
        // and the sync heals Mason's stale stripe_invoice_status at the same time.
        let deadStatus: string | null = null;
        try {
          const liveInvoice = await stripe.invoices.retrieve(stripeInvoiceIdFromMeta);
          if (liveInvoice.status === 'void' || liveInvoice.status === 'uncollectible') {
            deadStatus = liveInvoice.status;
            await syncInvoiceFromStripe(supabase, stripeInvoiceIdFromMeta, liveInvoice);
          }
        } catch {
          // Could not verify the live status — treat as a real failure below.
        }

        if (deadStatus) {
          const orphanAmount = typeof session.amount_total === 'number' ? session.amount_total : 0;
          console.error(
            JSON.stringify({
              level: 'error',
              alert: 'stripe_orphaned_partial_payment',
              message:
                `attach_payment refused: Stripe invoice is ${deadStatus} — NOT attached; orphan recorded; reconcile manually (refund or re-invoice)`,
              mason_invoice_id: invoiceRow.id,
              organization_id: urlOrganizationId,
              stripe_invoice_id: stripeInvoiceIdFromMeta,
              checkout_session_id: session.id,
              payment_intent_id: paymentIntentId,
              amount: orphanAmount,
              stripe_error: errBody.slice(0, 500),
            }),
          );await ingestStripePayment(supabase, {
        organization_id: urlOrganizationId,
        stripe: null,
        // Deliberately NOT linked to the dead invoice: lands in Needs review for a person.
        stripe_invoice_id: null,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: null,
        amount: orphanAmount,
        reference: `Paid against void/deleted invoice ${invoiceRow.id} — refund or re-invoice`,
      });
          return jsonResponse({ received: true, orphaned: true });
        }

        // Real failure (network, auth, paid/draft, unknown): 500 so Stripe retries.
        console.error(
          JSON.stringify({
            level: 'error',
            alert: 'stripe_attach_payment_failed',
            message: 'attach_payment returned non-200 — returning 500 so Stripe retries',
            mason_invoice_id: invoiceRow.id,
            organization_id: urlOrganizationId,
            stripe_invoice_id: stripeInvoiceIdFromMeta,
            checkout_session_id: session.id,
            payment_intent_id: paymentIntentId,
            http_status: attachRes.status,
            stripe_error: errBody.slice(0, 500),
          }),
        );
        return jsonResponse({ error: 'Failed to attach payment to invoice' }, 500);
      }
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

      const ok = await ingestStripePayment(supabase, {
        organization_id: urlOrganizationId,
        stripe,
        stripe_invoice_id: stripeInvoiceIdFromMeta,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId,
        amount,
      });
      if (!ok) return jsonResponse({ error: 'Failed to record payment' }, 500);
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

  // Both flags: stripe_status is set before ingestion, status only by the ledger, so a
  // retry after a failed ingestion is not swallowed.
  if (existing.stripe_status === 'paid' && existing.status === 'paid') {
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
  // status / paid_at / amount_paid / amount_remaining come from the ledger allocation.
  const updates: Record<string, unknown> = {
    stripe_status: 'paid',
    updated_at: now,
    payment_date: now.slice(0, 10),
    payment_method: 'Stripe',
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
    // The invoice row now carries this payment intent, so the ledger links it (Stripe-linked
    // → auto-confirmed) and marks the invoice paid from the allocation.
    const ok = await ingestStripePayment(supabase, {
      organization_id: urlOrganizationId,
      stripe: await stripeForOrg(ctx, existing.stripe_credential_mode as StripeCredentialMode | null),
      stripe_invoice_id: null,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      amount: paidAmount,
    });
    if (!ok) return jsonResponse({ error: 'Failed to record payment' }, 500);
  }

  await recordTestRoundTripIfEligible(supabase, urlOrganizationId, event.livemode);

  return jsonResponse({ received: true });
}

// =========================================================
// checkout.session.expired — pointer hygiene only
// =========================================================
async function handleCheckoutSessionExpired(ctx: WebhookContext): Promise<Response> {
  const { event, supabase, urlOrganizationId } = ctx;
  const session = event.data.object as Stripe.Checkout.Session;

  // Partial-link sessions carry mason_invoice_id; standalone sessions carry invoice_id.
  const masonInvoiceId =
    (session.metadata?.mason_invoice_id as string | undefined) ??
    (session.metadata?.invoice_id as string | undefined) ??
    null;
  if (!masonInvoiceId) return jsonResponse({ received: true });

  const existing = await loadInvoiceByMasonId(supabase, masonInvoiceId);
  if (!existing) return jsonResponse({ received: true });
  if (existing.organization_id !== urlOrganizationId) {
    await assertInvoiceBelongsToUrlOrg(supabase, urlOrganizationId, masonInvoiceId, event);
    return ignoreOrgMismatch();
  }

  // Only clear the stored pointer when it still points at THIS session — a newer session
  // may have been stamped since (expire-before-overwrite mints replacements, and our own
  // void-path expirations arrive here too).
  const storedSessionId = ((existing.stripe_checkout_session_id as string | null) ?? '').trim();
  if (storedSessionId !== session.id) {
    return jsonResponse({ received: true });
  }

  const updates: Record<string, unknown> = {
    stripe_checkout_session_id: null,
    updated_at: new Date().toISOString(),
  };
  // stripe_status 'pending' is written only by stripe-create-checkout-session for
  // standalone sessions; reset it only when no hosted invoice exists (hosted state wins).
  if (
    (existing.stripe_status as string | null) === 'pending' &&
    !(existing.stripe_invoice_id as string | null)
  ) {
    updates.stripe_status = 'unpaid';
  }

  const { error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', existing.id as string);
  if (error) {
    console.error('checkout.session.expired: failed to clear session pointer', {
      masonInvoiceId,
      sessionId: session.id,
      error,
    });
  }
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

  await syncInvoiceFromStripe(ctx.supabase, stripeInvoiceId, stripeInvoice);

  // Ledger upsert is idempotent per charge, so no delta arithmetic against amount_paid.
  const paymentAmount = stripeInvoice.amount_paid ?? 0;
  if (paymentAmount > 0) {
    const paymentIntentId =
      typeof stripeInvoice.payment_intent === 'string'
        ? stripeInvoice.payment_intent
        : (stripeInvoice.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;
    const chargeId =
      typeof stripeInvoice.charge === 'string'
        ? stripeInvoice.charge
        : (stripeInvoice.charge as Stripe.Charge | null)?.id ?? null;

    const ok = await ingestStripePayment(ctx.supabase, {
      organization_id: ctx.urlOrganizationId,
      stripe: await stripeForOrg(ctx, row.stripe_credential_mode as StripeCredentialMode | null),
      stripe_invoice_id: stripeInvoiceId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      amount: paymentAmount,
    });
    if (!ok) return jsonResponse({ error: 'Failed to record payment' }, 500);
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

  // status / paid_at / amount_paid / amount_remaining are derived from the ledger.
  const updates: Record<string, unknown> = {
    stripe_status: 'paid',
    stripe_invoice_status: 'paid',
    hosted_invoice_url: stripeInvoice.hosted_invoice_url ?? null,
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

  const paymentAmount = stripeInvoice.amount_paid ?? 0;
  if (paymentAmount > 0) {
    const ok = await ingestStripePayment(ctx.supabase, {
      organization_id: ctx.urlOrganizationId,
      stripe: await stripeForOrg(ctx, existing.stripe_credential_mode as StripeCredentialMode | null),
      stripe_invoice_id: stripeInvoiceId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      amount: paymentAmount,
    });
    if (!ok) return jsonResponse({ error: 'Failed to record payment' }, 500);
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

// =========================================================
// Refunds and disputes → negative ledger rows that follow their charge
// =========================================================
async function handleChargeRefunded(ctx: WebhookContext): Promise<Response> {
  const obj = ctx.event.data.object as Stripe.Charge | Stripe.Refund;
  const refunds: Stripe.Refund[] =
    obj.object === 'refund' ? [obj as Stripe.Refund] : ((obj as Stripe.Charge).refunds?.data ?? []);
  for (const r of refunds) {
    const row = mapStripeRefund(ctx.urlOrganizationId, r as unknown as Parameters<typeof mapStripeRefund>[1], { refund_id: r.id });
    const { error } = await ctx.supabase.rpc('ledger_ingest_payment', { p: row });
    if (error) {
      console.error('ledger refund ingest failed', error.code);
      return jsonResponse({ error: 'Failed to record refund' }, 500);
    }
  }
  return jsonResponse({ received: true });
}

async function handleChargeDispute(ctx: WebhookContext): Promise<Response> {
  const d = ctx.event.data.object as Stripe.Dispute;
  const row = mapStripeDispute(ctx.urlOrganizationId, d as unknown as Parameters<typeof mapStripeDispute>[1], { dispute_id: d.id });
  const { error } = await ctx.supabase.rpc('ledger_ingest_payment', { p: row });
  if (error) {
    console.error('ledger dispute ingest failed', error.code);
    return jsonResponse({ error: 'Failed to record dispute' }, 500);
  }
  return jsonResponse({ received: true });
}
