/**
 * Send (or re-send) a Stripe Invoice so the customer receives the hosted invoice link.
 * Used when staff clicks "Request payment". Returns latest hosted_invoice_url and status.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';
import {
  createReconciliationStripeClient,
  type StripeCredentialMode,
} from '../_shared/stripeOrgCredentials.ts';

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

    // No global STRIPE_SECRET_KEY — credentials resolve per-org from the invoice's stamped mode.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, organization_id, stripe_credential_mode, stripe_invoice_id, stripe_invoice_status')
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

    // --- Fail closed: no org => never a global-key fallback ---
    const rawOrgId = invoice.organization_id;
    if (!rawOrgId || typeof rawOrgId !== 'string' || !rawOrgId.trim()) {
      console.error('Invoice has no organization_id; cannot resolve Stripe credentials', invoice.id);
      return jsonResponse({ error: 'Invoice is not associated with an organization' }, 422);
    }
    const orgId = rawOrgId.trim();

    // --- Service the existing invoice in its stamped mode. Re-sending an existing invoice's
    //     hosted link is not new charge initiation (the link already exists and is payable),
    //     so reconciliation creds — stamped mode, no kill switch. ---
    const stampedMode = invoice.stripe_credential_mode as StripeCredentialMode | null;
    if (!stampedMode) {
      console.error('Existing Stripe invoice has no stamped mode; refusing send', {
        invoiceId: invoice.id,
        stripeInvoiceId: invoice.stripe_invoice_id,
      });
      return jsonResponse({
        error: 'Existing Stripe invoice predates per-org config; resolve it manually first',
      }, 409);
    }

    let stripe: Stripe;
    try {
      ({ stripe } = await createReconciliationStripeClient(supabase, orgId, stampedMode));
    } catch (resolveErr) {
      const reason = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
      console.error('Failed to resolve Stripe credentials', { orgId, invoiceId: invoice.id, stampedMode, reason });
      return jsonResponse({ error: 'Payment processing is not available for this organization' }, 503);
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