/**
 * Fetch latest state of a Stripe Invoice and sync to Mason invoice
 * (amount_paid, amount_remaining, stripe_invoice_status, hosted_invoice_url).
 * Does not insert into invoice_payments; webhook is source of truth for payment rows.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-admin-token',
};

interface FetchInvoiceRequest {
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

    let body: FetchInvoiceRequest;
    try {
      body = (await req.json()) as FetchInvoiceRequest;
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
      .select('id, stripe_invoice_id')
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice?.stripe_invoice_id) {
      return jsonResponse({ error: 'Invoice not found or no Stripe invoice linked' }, invoice ? 400 : 404);
    }

    const si = await stripe.invoices.retrieve(invoice.stripe_invoice_id);
    const amountPaid = si.amount_paid ?? 0;
    const amountRemaining = si.amount_remaining ?? null;
    const hostedUrl = si.hosted_invoice_url ?? null;
    const status = (si.status ?? 'open') as string;

    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        stripe_invoice_status: status,
        amount_paid: amountPaid,
        amount_remaining: amountRemaining,
        hosted_invoice_url: hostedUrl,
        locked_at: amountPaid > 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    if (updateErr) {
      return jsonResponse({ error: 'Failed to update invoice' }, 500);
    }

    return jsonResponse({
      stripe_invoice_status: status,
      amount_paid: amountPaid,
      amount_remaining: amountRemaining,
      hosted_invoice_url: hostedUrl,
    });
  } catch (e) {
    console.error('stripe-fetch-invoice error', e);
    return jsonResponse({ error: 'Unexpected error' }, 500);
  }
});
