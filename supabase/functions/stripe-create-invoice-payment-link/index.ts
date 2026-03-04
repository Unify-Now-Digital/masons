import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const appUrl = Deno.env.get('APP_URL') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }
    if (!stripeSecret) {
      return jsonResponse({ error: 'STRIPE_SECRET_KEY not configured' }, 500);
    }
    if (!appUrl) {
      return jsonResponse({ error: 'APP_URL not configured' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const stripe = new Stripe(stripeSecret);

    // Load Mason invoice
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, user_id, invoice_number, stripe_invoice_id')
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice) {
      return jsonResponse({ error: 'Invoice not found' }, 404);
    }
    if (!invoice.stripe_invoice_id) {
      return jsonResponse({ error: 'Stripe invoice not linked to this invoice' }, 400);
    }

    const stripeInvoiceId = invoice.stripe_invoice_id;

    // Retrieve Stripe invoice
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

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: stripeInvoice.currency,
            product_data: {
              name: `Invoice ${invoice.invoice_number} partial payment`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: {
          mason_invoice_id: invoice.id,
          stripe_invoice_id: stripeInvoiceId,
          payment_kind: 'partial',
          app_user_id: invoice.user_id ?? '',
        },
      },
      success_url: `${appUrl}/dashboard/invoicing?invoice=${invoice.id}&pay=success`,
      cancel_url: `${appUrl}/dashboard/invoicing?invoice=${invoice.id}&pay=cancel`,
      metadata: {
        mason_invoice_id: invoice.id,
        stripe_invoice_id: stripeInvoiceId,
        payment_kind: 'partial',
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

