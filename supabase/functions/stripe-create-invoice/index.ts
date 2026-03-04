import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-admin-token',
};

interface CreateInvoiceRequest {
  invoice_id: string;
}

interface OrderRow {
  id: string;
  order_type: string;
  value: number | null;
  renovation_service_cost: number | null;
  renovation_service_description: string | null;
  permit_cost: number | null;
  additional_options_total: number | null;
  sku: string | null;
  material: string | null;
  color: string | null;
  customer_email: string | null;
  person_id: string | null;
}

interface OrderOptionRow {
  id: string;
  name: string | null;
  cost: number;
}

function getOrderTotal(order: OrderRow): number {
  const base = order.order_type === 'Renovation'
    ? (order.renovation_service_cost ?? 0)
    : (order.value ?? 0);
  const permit = order.permit_cost ?? 0;
  const options = order.additional_options_total ?? 0;
  return base + permit + options;
}

function toPence(amount: number | null | undefined): number | null {
  if (amount == null || Number(amount) <= 0) return null;
  return Math.round(Number(amount) * 100);
}

function baseProductDescription(order: OrderRow): string {
  if (order.order_type === 'Renovation') {
    return (order.renovation_service_description?.trim() || 'Renovation service');
  }
  if (order.sku?.trim()) return order.sku.trim();
  const parts = [order.material?.trim(), order.color?.trim()].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return 'Order';
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
    // --- Auth ---
    const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');
    if (!expectedToken || !adminToken || adminToken !== expectedToken) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // --- Parse body ---
    let body: CreateInvoiceRequest;
    try {
      body = (await req.json()) as CreateInvoiceRequest;
    } catch {
      return jsonResponse({ error: 'Invalid JSON or missing body' }, 400);
    }

    const invoiceId = body?.invoice_id;
    if (!invoiceId || typeof invoiceId !== 'string' || !invoiceId.trim()) {
      return jsonResponse({ error: 'invoice_id is required' }, 400);
    }

    // --- Env ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Supabase URL or SERVICE_ROLE_KEY missing');
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }
    if (!stripeSecret) {
      return jsonResponse({ error: 'STRIPE_SECRET_KEY not configured' }, 500);
    }

    const permitProductId = (Deno.env.get('STRIPE_PRODUCT_ID_PERMIT') ?? '').trim();
    const memorialProductId = (Deno.env.get('STRIPE_PRODUCT_ID_MEMORIAL') ?? '').trim();
    const optionProductId = (Deno.env.get('STRIPE_PRODUCT_ID_OPTION') ?? '').trim();

    if (!permitProductId) {
      return jsonResponse({ error: 'Missing Stripe product ID secret: STRIPE_PRODUCT_ID_PERMIT' }, 500);
    }
    if (!memorialProductId) {
      return jsonResponse({ error: 'Missing Stripe product ID secret: STRIPE_PRODUCT_ID_MEMORIAL' }, 500);
    }
    if (!optionProductId) {
      return jsonResponse({ error: 'Missing Stripe product ID secret: STRIPE_PRODUCT_ID_OPTION' }, 500);
    }

    if (!permitProductId.startsWith('prod_') || !memorialProductId.startsWith('prod_') || !optionProductId.startsWith('prod_')) {
      const bad = [
        !permitProductId.startsWith('prod_') && 'STRIPE_PRODUCT_ID_PERMIT',
        !memorialProductId.startsWith('prod_') && 'STRIPE_PRODUCT_ID_MEMORIAL',
        !optionProductId.startsWith('prod_') && 'STRIPE_PRODUCT_ID_OPTION',
      ].filter(Boolean);
      return jsonResponse({
        error: `Invalid Stripe product ID (must start with prod_): ${bad.join(', ')}`,
      }, 500);
    }

    console.log('Stripe product IDs:', {
      STRIPE_PRODUCT_ID_PERMIT: permitProductId,
      STRIPE_PRODUCT_ID_MEMORIAL: memorialProductId,
      STRIPE_PRODUCT_ID_OPTION: optionProductId,
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const stripe = new Stripe(stripeSecret);

    // --- Fetch Mason invoice ---
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, stripe_invoice_id, stripe_invoice_status, status, user_id')
      .eq('id', invoiceId.trim())
      .single();

    if (invError || !invoice) {
      return jsonResponse({ error: 'Invoice not found' }, 404);
    }

    // --- Mason-level guard: already paid? ---
    if (invoice.status === 'paid') {
      return jsonResponse({ error: 'Invoice is already paid' }, 400);
    }

    // --- Idempotency: Stripe Invoice already created? ---
    if (invoice.stripe_invoice_id) {
      const existing = await stripe.invoices.retrieve(invoice.stripe_invoice_id, {
        expand: ['payment_intent'],
      });

      const hostedUrl = existing.hosted_invoice_url ?? null;
      const invoicePdf = existing.invoice_pdf ?? null;

      switch (existing.status) {
        case 'paid': {
          return jsonResponse({
            stripe_invoice_id: existing.id,
            hosted_invoice_url: hostedUrl,
            invoice_pdf: invoicePdf,
            stripe_invoice_status: existing.status,
            amount_paid: existing.amount_paid ?? 0,
            amount_remaining: existing.amount_remaining ?? 0,
          });
        }
        case 'open':
        case 'draft': {
          let inv = existing;
          if (existing.status === 'draft') {
            await stripe.invoices.finalizeInvoice(existing.id, { auto_advance: false });
            inv = await stripe.invoices.retrieve(existing.id);
            const invAmountPaid = inv.amount_paid ?? 0;
            const invAmountRemaining = inv.amount_remaining ?? null;
            await supabase.from('invoices').update({
              stripe_invoice_status: 'open',
              hosted_invoice_url: inv.hosted_invoice_url ?? null,
              amount_paid: invAmountPaid,
              amount_remaining: invAmountRemaining,
              locked_at: invAmountPaid > 0 ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            }).eq('id', invoice.id);
          }
          const finalUrl = inv.hosted_invoice_url ?? null;
          const finalPdf = inv.invoice_pdf ?? null;
          if (finalUrl) {
            return jsonResponse({
              stripe_invoice_id: inv.id,
              hosted_invoice_url: finalUrl,
              invoice_pdf: finalPdf,
              stripe_invoice_status: inv.status ?? 'open',
              amount_paid: inv.amount_paid ?? 0,
              amount_remaining: inv.amount_remaining ?? null,
            });
          }
          return jsonResponse({ error: 'Could not retrieve hosted URL for existing Stripe invoice' }, 500);
        }
        case 'void':
        case 'uncollectible': {
          await supabase.from('invoices').update({
            stripe_invoice_id: null,
            stripe_invoice_status: null,
            stripe_payment_intent_id: null,
            hosted_invoice_url: null,
            amount_paid: 0,
            amount_remaining: null,
            locked_at: null,
            updated_at: new Date().toISOString(),
          }).eq('id', invoice.id);
          break;
        }
        default: {
          return jsonResponse({ error: `Stripe invoice is in unexpected status: ${existing.status}` }, 400);
        }
      }
    }

    // --- Fetch orders (with columns needed for line item descriptions) ---
    const { data: orders, error: ordError } = await supabase
      .from('orders_with_options_total')
      .select('id, order_type, value, renovation_service_cost, renovation_service_description, permit_cost, additional_options_total, sku, material, color, customer_email, person_id')
      .eq('invoice_id', invoice.id);

    if (ordError) {
      console.error('Failed to load orders for invoice', ordError);
      return jsonResponse({ error: 'Failed to load invoice orders' }, 500);
    }

    const orderList = (orders ?? []) as OrderRow[];
    const totalPounds = orderList.reduce((sum, o) => sum + getOrderTotal(o), 0);
    const totalPence = Math.round(totalPounds * 100);

    if (totalPence <= 0) {
      return jsonResponse({ error: 'Invoice total must be greater than zero' }, 400);
    }

    // --- Derive customer email from People (customers table) or orders as fallback ---
    let peopleEmail: string | null = null;
    let emailSource: 'people' | 'orders' | 'none' = 'none';

    const primaryWithPerson = orderList.find((o) => o.person_id) ?? orderList[0];
    if (primaryWithPerson?.person_id) {
      const { data: person, error: personErr } = await supabase
        .from('customers')
        .select('email')
        .eq('id', primaryWithPerson.person_id)
        .single();
      if (!personErr && person?.email && typeof person.email === 'string') {
        const trimmed = person.email.trim();
        if (trimmed) {
          peopleEmail = trimmed;
          emailSource = 'people';
        }
      }
    }

    const firstWithOrderEmail = orderList.find((o) => o.customer_email && o.customer_email.trim());
    const orderEmail = firstWithOrderEmail?.customer_email?.trim() || null;

    const customerEmail = peopleEmail ?? orderEmail ?? null;
    if (!customerEmail) {
      return jsonResponse({
        error:
          'Customer email is required to create Stripe invoice links (send_invoice). Please add email to the customer.',
      }, 400);
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(customerEmail)) {
      return jsonResponse({ error: 'Invalid customer email' }, 400);
    }

    console.log('stripe-create-invoice email source', {
      source: emailSource,
      email: customerEmail,
    });

    // --- Create Stripe Customer (ensure email set for send_invoice flow) ---
    const customer = await stripe.customers.create({
      name: invoice.customer_name || 'Customer',
      email: customerEmail,
      metadata: { mason_invoice_id: invoice.id },
    });

    // --- Create Stripe Invoice (draft); send_invoice = customer pays on hosted page (supports partial payments) ---
    const stripeInvoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 30,
      auto_advance: false,
      metadata: { mason_invoice_id: invoice.id },
    });

    // --- Add line items per order: base, permit, then each additional option ---
    let addedPence = 0;
    for (const order of orderList) {
      const metaBase = { mason_invoice_id: invoice.id, mason_order_id: order.id };

      // a) Base product/service line
      const baseAmount = order.order_type === 'Renovation'
        ? (order.renovation_service_cost ?? 0)
        : (order.value ?? 0);
      const basePence = toPence(baseAmount);
      if (basePence != null) {
        await stripe.invoiceItems.create({
          customer: customer.id,
          invoice: stripeInvoice.id,
          price_data: {
            currency: 'gbp',
            product: memorialProductId,
            unit_amount: basePence,
          },
          quantity: 1,
          description: baseProductDescription(order),
          metadata: { ...metaBase, line_type: 'base' },
        });
        addedPence += basePence;
      }

      // b) Permit line
      const permitPence = toPence(order.permit_cost);
      if (permitPence != null) {
        await stripe.invoiceItems.create({
          customer: customer.id,
          invoice: stripeInvoice.id,
          price_data: {
            currency: 'gbp',
            product: permitProductId,
            unit_amount: permitPence,
          },
          quantity: 1,
          description: 'Permit',
          metadata: { ...metaBase, line_type: 'permit' },
        });
        addedPence += permitPence;
      }

      // c) Additional options
      const { data: options, error: optErr } = await supabase
        .from('order_additional_options')
        .select('id, name, cost')
        .eq('order_id', order.id);

      if (optErr) {
        console.error('Failed to load order additional options', order.id, optErr);
        return jsonResponse({ error: 'Failed to load order options' }, 500);
      }

      const optionList = (options ?? []) as OrderOptionRow[];
      for (const opt of optionList) {
        const optPence = toPence(opt.cost);
        if (optPence != null) {
          await stripe.invoiceItems.create({
            customer: customer.id,
            invoice: stripeInvoice.id,
            price_data: {
              currency: 'gbp',
              product: optionProductId,
              unit_amount: optPence,
            },
            quantity: 1,
            description: opt.name?.trim() || 'Additional option',
            metadata: { ...metaBase, mason_option_id: opt.id, line_type: 'option' },
          });
          addedPence += optPence;
        }
      }
    }

    if (addedPence <= 0) {
      return jsonResponse({ error: 'Invoice total must be greater than zero' }, 400);
    }

    // --- Finalize (hosted_invoice_url available after finalize for send_invoice) ---
    await stripe.invoices.finalizeInvoice(stripeInvoice.id, {
      auto_advance: false,
    });

    const finalized = await stripe.invoices.retrieve(stripeInvoice.id);
    const hostedInvoiceUrl = finalized.hosted_invoice_url ?? null;
    const invoicePdfUrl = finalized.invoice_pdf ?? null;
    const amountPaid = finalized.amount_paid ?? 0;
    const amountRemaining = finalized.amount_remaining ?? null;

    // --- Persist on Mason invoice ---
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        stripe_invoice_id: finalized.id,
        stripe_invoice_status: (finalized.status ?? 'open') as string,
        hosted_invoice_url: hostedInvoiceUrl,
        amount_paid: amountPaid,
        amount_remaining: amountRemaining,
        locked_at: amountPaid > 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    if (updateErr) {
      console.error('Failed to update invoice with Stripe invoice data', updateErr);
      return jsonResponse({ error: 'Failed to update invoice' }, 500);
    }

    return jsonResponse({
      stripe_invoice_id: finalized.id,
      hosted_invoice_url: hostedInvoiceUrl,
      invoice_pdf: invoicePdfUrl,
      stripe_invoice_status: finalized.status ?? 'open',
      amount_paid: amountPaid,
      amount_remaining: amountRemaining,
    });
  } catch (e) {
    console.error('stripe-create-invoice error', e);
    return jsonResponse({ error: 'Unexpected error' }, 500);
  }
});
