import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import {
  createOutboundStripeClient,
  createReconciliationStripeClient,
  type StripeCredentialMode,
} from '../_shared/stripeOrgCredentials.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-admin-token',
};

interface CreateCheckoutRequest {
  invoice_id: string;
}

interface OrderRow {
  id: string;
  order_type: string;
  value: number | null;
  renovation_service_cost: number | null;
  permit_cost: number | null;
  additional_options_total: number | null;
}

/** Coerce to number; Supabase/PostgREST may return numeric columns as strings. */
function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getOrderTotal(order: OrderRow): number {
  const base = order.order_type === 'Renovation'
    ? toNum(order.renovation_service_cost)
    : toNum(order.value);
  const permit = toNum(order.permit_cost);
  const options = toNum(order.additional_options_total);
  const total = base + permit + options;
  return Number.isFinite(total) ? total : 0;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');
    if (!expectedToken || !adminToken || adminToken !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: CreateCheckoutRequest;
    try {
      body = (await req.json()) as CreateCheckoutRequest;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON or missing body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const invoiceId = body?.invoice_id;
    if (!invoiceId || typeof invoiceId !== 'string' || !invoiceId.trim()) {
      return new Response(
        JSON.stringify({ error: 'invoice_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const appOrigin = Deno.env.get('APP_ORIGIN');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Supabase URL or SERVICE_ROLE_KEY missing');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    // STRIPE_SECRET_KEY env read removed entirely — credentials now resolve per-org, fail-closed.
    if (!appOrigin) {
      return new Response(
        JSON.stringify({ error: 'APP_ORIGIN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const origin = appOrigin.replace(/\/$/, '');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Pull organization_id + any prior session/mode — org drives credential resolution,
    // prior session/mode drives the freeze-in-flight guard below.
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, invoice_number, organization_id, stripe_checkout_session_id, stripe_credential_mode')
      .eq('id', invoiceId.trim())
      .single();

    if (invError || !invoice) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fail closed: no org => nothing to resolve, and we never fall back to a global key.
    const rawOrgId = invoice.organization_id;
    if (!rawOrgId || typeof rawOrgId !== 'string' || !rawOrgId.trim()) {
      console.error('Invoice has no organization_id; cannot resolve Stripe credentials', invoice.id);
      return new Response(
        JSON.stringify({ error: 'Invoice is not associated with an organization' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const orgId = rawOrgId.trim();

    const { data: orders, error: ordError } = await supabase
      .from('orders_with_options_total')
      .select('id, order_type, value, renovation_service_cost, permit_cost, additional_options_total')
      .eq('invoice_id', invoice.id);

    if (ordError) {
      console.error('Failed to load orders for invoice', ordError);
      return new Response(
        JSON.stringify({ error: 'Failed to load invoice orders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const orderList = (orders ?? []) as OrderRow[];
    const totalPounds = orderList.reduce((sum, o) => sum + getOrderTotal(o), 0);
    const amountPence = Math.round(totalPounds * 100);
    if (amountPence <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invoice total must be greater than zero' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --- Freeze-in-flight guard: at most one open checkout session per invoice, and it's the
    // one whose mode is currently stamped. Before creating (and re-stamping) a new session,
    // neutralize any prior one — otherwise a stale session in a different mode could be paid
    // against credentials we've since overwritten on the invoice. ---
    const priorSessionId = (invoice.stripe_checkout_session_id ?? '').trim();
    const priorMode = invoice.stripe_credential_mode as StripeCredentialMode | null;

    if (priorSessionId) {
      if (!priorMode) {
        // Legacy session created before per-org stamping: mode unknown, so we can't safely
        // expire or reason about it. Refuse rather than risk a cross-mode double path.
        console.error('Prior session has no stamped mode; refusing to regenerate', {
          invoiceId: invoice.id,
          priorSessionId,
        });
        return new Response(
          JSON.stringify({
            error: 'Existing payment session predates per-org config; resolve it manually first',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      try {
        // Reconciliation client honors the STAMPED mode regardless of live_payments_enabled,
        // so we touch the old session with the same keys it was created under.
        const { stripe: priorStripe } = await createReconciliationStripeClient(
          supabase,
          orgId,
          priorMode,
        );
        const priorSession = await priorStripe.checkout.sessions.retrieve(priorSessionId);

        if (priorSession.status === 'complete') {
          // Already paid / finishing — do NOT open a second path. Let reconciliation settle it.
          console.error('Prior session already complete; refusing to regenerate', {
            invoiceId: invoice.id,
            priorSessionId,
            priorMode,
          });
          return new Response(
            JSON.stringify({
              error: 'This invoice already has a completed payment awaiting reconciliation',
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        if (priorSession.status === 'open') {
          await priorStripe.checkout.sessions.expire(priorSessionId);
        }
        // 'expired' (or other terminal): nothing to do.
      } catch (priorErr) {
        // Couldn't confirm the prior session is closed -> fail closed. Opening a new session in a
        // possibly-different mode now would leave two payable sessions under one stamped column.
        const reason = priorErr instanceof Error ? priorErr.message : String(priorErr);
        console.error('Failed to neutralize prior session; refusing to regenerate', {
          invoiceId: invoice.id,
          priorSessionId,
          priorMode,
          reason,
        });
        return new Response(
          JSON.stringify({
            error: 'Could not safely replace the existing payment session; try again shortly',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Outbound charge => kill switch (live_payments_enabled) is enforced inside the resolver.
    // createOutboundStripeClient returns { stripe, credentials } and THROWS when there's no
    // usable config row for the org (fail-closed).
    let outbound: Awaited<ReturnType<typeof createOutboundStripeClient>>;
    try {
      outbound = await createOutboundStripeClient(supabase, orgId);
    } catch (resolveErr) {
      const reason = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
      console.error('Failed to resolve outbound Stripe credentials', {
        orgId,
        invoiceId: invoice.id,
        reason,
      });
      return new Response(
        JSON.stringify({ error: 'Payment processing is not available for this organization' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { stripe, credentials } = outbound;
    const credentialMode = credentials.mode;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'gbp',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: amountPence,
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { invoice_id: invoice.id, organization_id: orgId },
      payment_intent_data: {
        metadata: { invoice_id: invoice.id, organization_id: orgId },
      },
      success_url: `${origin}/dashboard/invoicing?invoice_id=${invoice.id}&stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/invoicing?invoice_id=${invoice.id}&stripe=cancel`,
    });

    if (!session.url) {
      return new Response(
        JSON.stringify({ error: 'Stripe did not return a checkout URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Freeze-in-flight linchpin: stamp the mode the session was actually created with, in the
    // same write as the session id. Reconciliation reads this later, so flipping
    // live_payments_enabled mid-flight can't change how THIS session is verified/settled.
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        stripe_checkout_session_id: session.id,
        stripe_credential_mode: credentialMode,
        stripe_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    if (updateErr) {
      console.error('Failed to update invoice with session id', updateErr);
      return new Response(
        JSON.stringify({ error: 'Failed to update invoice' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('stripe-create-checkout-session error', e);
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});