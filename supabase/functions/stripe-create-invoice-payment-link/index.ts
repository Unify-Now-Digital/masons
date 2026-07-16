import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';
import {
  createReconciliationStripeClient,
  getOrganizationStripeConfigRow,
  type StripeCredentialMode,
} from '../_shared/stripeOrgCredentials.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-admin-token',
};

interface CreatePaymentLinkRequest {
  invoice_id: string;
  amount: number;
}

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

  try {
    const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');
    if (!expectedToken || !adminToken || adminToken !== expectedToken) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: CreatePaymentLinkRequest;
    try {
      body = (await req.json()) as CreatePaymentLinkRequest;
    } catch {
      return jsonResponse({ error: 'Invalid JSON or missing body' }, 400);
    }

    const invoiceId = body?.invoice_id?.trim();
    const amount = body?.amount;

    if (!invoiceId) {
      return jsonResponse({ error: 'invoice_id is required' }, 400);
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return jsonResponse({ error: 'amount must be a positive integer in smallest currency unit' }, 400);
    }

    // No global STRIPE_SECRET_KEY — credentials resolve per-org from the invoice's stamped mode.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const appUrl = Deno.env.get('APP_URL') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }
    if (!appUrl) {
      return jsonResponse({ error: 'APP_URL not configured' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load Mason invoice (amount in pounds). Pull org + stamped mode for credential resolution.
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, user_id, invoice_number, amount, organization_id, stripe_credential_mode, stripe_invoice_id')
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice) {
      return jsonResponse({ error: 'Invoice not found' }, 404);
    }
    if (!invoice.stripe_invoice_id) {
      return jsonResponse({ error: 'Stripe invoice not linked to this invoice' }, 400);
    }

    const stripeInvoiceId = invoice.stripe_invoice_id;

    // --- Fail closed: no org => never a global-key fallback ---
    const rawOrgId = invoice.organization_id;
    if (!rawOrgId || typeof rawOrgId !== 'string' || !rawOrgId.trim()) {
      console.error('Invoice has no organization_id; cannot resolve Stripe credentials', invoice.id);
      return jsonResponse({ error: 'Invoice is not associated with an organization' }, 422);
    }
    const orgId = rawOrgId.trim();

    // --- Mode is fixed by the existing Stripe invoice: it (and its customer) live in the account
    //     the invoice was created in. We run the WHOLE function in that stamped mode. ---
    const stampedMode = invoice.stripe_credential_mode as StripeCredentialMode | null;
    if (!stampedMode) {
      // Existing Stripe invoice predates per-org stamping: we can't know its account. Refuse;
      // resolve via backfill (see deploy notes). This is the common case for pre-012 invoices.
      console.error('Existing Stripe invoice has no stamped mode; refusing payment link', {
        invoiceId: invoice.id,
        stripeInvoiceId,
      });
      return jsonResponse({
        error: 'Existing Stripe invoice predates per-org config; resolve it manually first',
      }, 409);
    }

    // --- Kill-switch gate: minting a NEW payment link is new charge initiation, so the live
    //     kill switch applies even though the invoice already exists. Refuse a live link when
    //     live_payments_enabled is false. (Remove this block to treat partial payments as an
    //     in-flight continuation instead.) ---
    const cfgRow = await getOrganizationStripeConfigRow(supabase, orgId);
    if (!cfgRow) {
      return jsonResponse({ error: 'Payment processing is not available for this organization' }, 503);
    }
    if (stampedMode === 'live' && !cfgRow.live_payments_enabled) {
      console.error('Live payment link requested while live disabled; refusing', {
        invoiceId: invoice.id, orgId,
      });
      return jsonResponse({ error: 'Live payments are currently disabled for this organization' }, 403);
    }

    // --- Build Stripe client in the stamped mode (account-correct; reconciliation creds honor it) ---
    let stripe: Stripe;
    try {
      ({ stripe } = await createReconciliationStripeClient(supabase, orgId, stampedMode));
    } catch (resolveErr) {
      const reason = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
      console.error('Failed to resolve Stripe credentials', { orgId, invoiceId: invoice.id, stampedMode, reason });
      return jsonResponse({ error: 'Payment processing is not available for this organization' }, 503);
    }

    // Load linked orders with cost fields (view has additional_options_total)
    const { data: ordersForBreakdown = [] } = await supabase
      .from('orders_with_options_total')
      .select('id, order_number, order_type, sku, material, color, renovation_service_description, value, renovation_service_cost, permit_cost, additional_options_total, product_id, custom_product_name')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });

    // Resolve real product names (sku holds the grave number, not the product)
    const productIds = [...new Set(
      (ordersForBreakdown as Record<string, unknown>[])
        .map((o) => o.product_id as string | null)
        .filter(Boolean)
    )] as string[];
    const productNameById = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: prods, error: prodErr } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);
      if (prodErr) {
        console.error('Failed to load product names', prodErr);
        return jsonResponse({ error: 'Failed to load product names' }, 500);
      }
      for (const p of prods ?? []) {
        if ((p as { name: string | null }).name) {
          productNameById.set((p as { id: string }).id, (p as { name: string }).name);
        }
      }
    }

    const formatOrderId = (order: { order_number?: number | null }) =>
      order.order_number != null
        ? `ORD-${String(order.order_number).padStart(6, '0')}`
        : '';

    const toNum = (v: unknown): number => {
      if (v == null) return 0;
      const n = typeof v === 'string' ? parseFloat(v) : Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    // Build cost breakdown (label, amount in pence) — same structure as InvoiceDetailSidebar
    interface BreakdownItem {
      label: string;
      amountPence: number;
    }
    // Specific product/option names so the payer sees exactly what they're paying for
    // (mirrors the hosted-invoice line items). Label: "<order type> — <name>".
    // NOTE: this label rule is duplicated in stripe-create-invoice and
    // stripe-create-checkout-session — keep all three in sync.
    const baseProductName = (o: Record<string, unknown>): string => {
      const orderType = (o.order_type as string) || '';
      if (orderType === 'Renovation') {
        return `Renovation — ${((o.renovation_service_description as string)?.trim()) || 'Renovation service'}`;
      }
      // Name chain: custom name → product name → material · colour → 'Memorial'.
      // sku is deliberately excluded — it holds the grave number, not a product name.
      const pid = o.product_id as string | null;
      const name =
        (o.custom_product_name as string | null)?.trim()
        || (pid ? productNameById.get(pid) : undefined)?.trim()
        || [(o.material as string)?.trim(), (o.color as string)?.trim()].filter(Boolean).join(' · ')
        || 'Memorial';
      const typeSegment = orderType.trim() || 'Order';
      return `${typeSegment} — ${name}`;
    };

    const breakdown: BreakdownItem[] = [];
    for (const o of ordersForBreakdown as Record<string, unknown>[]) {
      const orderIdStr = formatOrderId(o as { order_number?: number | null });
      const orderType = (o.order_type as string) || '';
      const basePounds = orderType === 'Renovation' ? toNum(o.renovation_service_cost) : toNum(o.value);
      const permitPounds = toNum(o.permit_cost);
      const basePence = Math.round(basePounds * 100);
      const permitPence = Math.round(permitPounds * 100);
      const prefix = orderIdStr ? `${orderIdStr} ` : '';

      if (basePence > 0) breakdown.push({ label: `${prefix}${baseProductName(o)}`, amountPence: basePence });
      if (permitPence > 0) breakdown.push({ label: `${prefix}Permit`, amountPence: permitPence });

      // One line per named option (replaces the single lumped "Additional options" line).
      const { data: opts, error: optErr } = await supabase
        .from('order_additional_options')
        .select('id, name, cost')
        .eq('order_id', o.id as string);
      if (optErr) {
        console.error('Failed to load order additional options', o.id, optErr);
        return jsonResponse({ error: 'Failed to load order options' }, 500);
      }
      for (const opt of opts ?? []) {
        const optPence = Math.round(toNum((opt as { cost: unknown }).cost) * 100);
        if (optPence > 0) {
          const optName = ((opt as { name: string | null }).name)?.trim() || 'Option';
          breakdown.push({ label: `${prefix}${optName}`, amountPence: optPence });
        }
      }
    }
    const totalBreakdownPence = breakdown.reduce((s, i) => s + i.amountPence, 0);

    // Order IDs and description text for metadata / single-line fallback
    const orderIdList: string[] = [];
    const orderLines = (ordersForBreakdown as Record<string, unknown>[]).map((o: Record<string, unknown>) => {
      const idStr = formatOrderId(o as { order_number?: number | null });
      if (idStr) orderIdList.push(idStr);
      const label = baseProductName(o);
      return idStr ? `${idStr} ${label}` : label;
    });
    const orderDetail =
      orderLines.length > 0
        ? `Orders: ${orderLines.join('; ')}`.slice(0, 500)
        : `Invoice ${invoice.invoice_number}`;
    const orderSummaryMeta = orderIdList.length > 0 ? orderIdList.join(', ') : invoice.invoice_number;

    // Retrieve Stripe invoice (in the stamped mode)
    const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId, {
      expand: ['customer'],
    });

    if (!stripeInvoice.currency) {
      return jsonResponse({ error: 'Stripe invoice currency is missing' }, 500);
    }

    if (['paid', 'void', 'uncollectible'].includes(stripeInvoice.status ?? '')) {
      return jsonResponse({ error: `Cannot create payment link for invoice in status ${stripeInvoice.status}` }, 400);
    }

    const amountRemaining = stripeInvoice.amount_remaining ?? 0;
    if (amountRemaining <= 0) {
      return jsonResponse({ error: 'Invoice has no remaining balance' }, 400);
    }
    if (amount > amountRemaining) {
      return jsonResponse({ error: 'amount cannot exceed invoice remaining balance' }, 400);
    }

    const customerId =
      typeof stripeInvoice.customer === 'string'
        ? stripeInvoice.customer
        : (stripeInvoice.customer as Stripe.Customer | null)?.id ?? null;

    if (!customerId) {
      return jsonResponse({ error: 'Stripe invoice has no customer attached' }, 500);
    }

    const paymentIntentDescription =
      orderIdList.length > 0
        ? `Partial payment for ${invoice.invoice_number} (${orderIdList.join(', ')})`
        : `Partial payment for ${invoice.invoice_number}`;

    // Prorate breakdown so line items sum to exact partial amount (Stripe charges sum of line items)
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    if (breakdown.length === 0 || totalBreakdownPence <= 0) {
      lineItems = [
        {
          price_data: {
            currency: stripeInvoice.currency,
            product_data: {
              name: `Partial payment for Invoice ${invoice.invoice_number}`,
              description: orderDetail,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ];
    } else {
      const ratio = amount / totalBreakdownPence;
      const prorated: number[] = breakdown.map((i) => Math.max(0, Math.floor(i.amountPence * ratio)));
      let sum = prorated.reduce((a, b) => a + b, 0);
      const diff = amount - sum;
      if (diff !== 0 && prorated.length > 0) {
        prorated[prorated.length - 1] += diff;
      }
      const withAmounts = breakdown
        .map((item, i) => ({ label: item.label, unitAmount: prorated[i] }))
        .filter((x) => x.unitAmount >= 1);
      if (withAmounts.length === 0) {
        lineItems = [
          {
            price_data: {
              currency: stripeInvoice.currency,
              product_data: {
                name: `Partial payment for Invoice ${invoice.invoice_number}`,
                description: orderDetail,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ];
      } else {
        const lineSum = withAmounts.reduce((s, x) => s + x.unitAmount, 0);
        const adjust = amount - lineSum;
        withAmounts[withAmounts.length - 1].unitAmount += adjust;
        if (withAmounts[withAmounts.length - 1].unitAmount < 1) {
          lineItems = [
            {
              price_data: {
                currency: stripeInvoice.currency,
                product_data: {
                  name: `Partial payment for Invoice ${invoice.invoice_number}`,
                  description: orderDetail,
                },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ];
        } else {
          lineItems = withAmounts.map((item) => ({
            price_data: {
              currency: stripeInvoice.currency,
              product_data: {
                name: `${item.label} (partial)`,
                description: `Invoice ${invoice.invoice_number}`,
              },
              unit_amount: item.unitAmount,
            },
            quantity: 1,
          })) as Stripe.Checkout.SessionCreateParams.LineItem[];
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: lineItems,
      payment_intent_data: {
        description: paymentIntentDescription.slice(0, 500),
        metadata: {
          mason_invoice_id: invoice.id,
          organization_id: orgId,
          stripe_invoice_id: stripeInvoiceId,
          payment_kind: 'partial',
          app_user_id: invoice.user_id ?? '',
          invoice_number: invoice.invoice_number ?? '',
          order_summary: orderSummaryMeta.slice(0, 500),
        },
      },
      success_url: `${appUrl}/dashboard/invoicing?invoice=${invoice.id}&pay=success`,
      cancel_url: `${appUrl}/dashboard/invoicing?invoice=${invoice.id}&pay=cancel`,
      metadata: {
        mason_invoice_id: invoice.id,
        organization_id: orgId,
        stripe_invoice_id: stripeInvoiceId,
        payment_kind: 'partial',
        invoice_number: invoice.invoice_number ?? '',
        order_summary: orderSummaryMeta.slice(0, 500),
      },
      custom_text: {
        submit: {
          message: 'This is a partial payment for the invoice above.',
        },
      },
    });

    return jsonResponse({
      checkout_url: session.url,
      session_id: session.id,
      amount,
      currency: stripeInvoice.currency,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    console.error('stripe-create-invoice-payment-link error', e);
    return jsonResponse({ error: msg }, 500);
  }
});