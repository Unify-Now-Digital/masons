/**
 * Send (or re-send) a Stripe Invoice so the customer receives the hosted invoice link.
 * Used when staff clicks "Request payment". Returns latest hosted_invoice_url and status.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-admin-token',
};

interface SendInvoiceRequest {
  invoice_id: string;
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

    let body: SendInvoiceRequest;
    try {
      body = (await req.json()) as SendInvoiceRequest;
    } catch {
      return jsonResponse({ error: 'Invalid JSON or missing body' }, 400);
    }

    const invoiceId = body?.invoice_id?.trim();
    if (!invoiceId) {
      return jsonResponse({ error: 'invoice_id is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }
    if (!stripeSecret) {
      return jsonResponse({ error: 'STRIPE_SECRET_KEY not configured' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const stripe = new Stripe(stripeSecret);

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, stripe_invoice_id, stripe_invoice_status')
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice) {
      return jsonResponse({ error: 'Invoice not found' }, 404);
    }

    if (!invoice.stripe_invoice_id) {
      return jsonResponse(
        { error: 'No Stripe invoice linked. Create a Stripe invoice first.' },
        400
      );
    }

    // Retrieve Stripe invoice and ensure there is an email we can send to.
    const stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id, {
      expand: ['customer'],
    });

    const customerEmail =
      stripeInvoice.customer_email ??
      (typeof stripeInvoice.customer === 'object' && stripeInvoice.customer
        ? (stripeInvoice.customer as Stripe.Customer).email ?? null
        : null);

    if (!customerEmail) {
      return jsonResponse(
        {
          error:
            'Customer email required to email invoice. Use hosted link instead.',
        },
        400,
      );
    }

    const sent = await stripe.invoices.sendInvoice(stripeInvoice.id);
    const hostedUrl = sent.hosted_invoice_url ?? null;

    await supabase
      .from('invoices')
      .update({
        stripe_invoice_status: sent.status ?? invoice.stripe_invoice_status,
        hosted_invoice_url: hostedUrl,
        amount_paid: sent.amount_paid ?? 0,
        amount_remaining: sent.amount_remaining ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    return jsonResponse({
      stripe_invoice_id: sent.id,
      hosted_invoice_url: hostedUrl,
      stripe_invoice_status: sent.status ?? 'open',
    });
  } catch (e) {
    console.error('stripe-send-invoice error', e);
    return jsonResponse({ error: 'Unexpected error' }, 500);
  }
});
