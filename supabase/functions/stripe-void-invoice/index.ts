/**
 * Void-only: void a Stripe invoice WITHOUT touching the Mason invoice row's lifecycle —
 * no soft-delete (that's invoices-delete) and no replacement invoice (that's
 * stripe-revise-invoice). Strict semantics: unlike invoices-delete's best-effort void,
 * any failure here fails the request and nothing is mutated. Guards mirror
 * stripe-revise-invoice phase 1; already-void/uncollectible is an idempotent success.
 * The Mason row's stripe_invoice_status is stamped only when the Stripe side is
 * confirmed dead.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
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

interface VoidInvoiceRequest {
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

    let body: VoidInvoiceRequest;
    try {
      body = (await req.json()) as VoidInvoiceRequest;
    } catch {
      return jsonResponse({ error: 'Invalid JSON or missing body' }, 400);
    }

    const invoiceId = body?.invoice_id?.trim();
    if (!invoiceId) {
      return jsonResponse({ error: 'invoice_id is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, organization_id, stripe_credential_mode, stripe_invoice_id')
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice) {
      return jsonResponse({ error: 'Invoice not found' }, 404);
    }

    if (!invoice.stripe_invoice_id) {
      return jsonResponse({ error: 'Invoice has no Stripe invoice to void' }, 400);
    }

    const orgId = (invoice.organization_id ?? '').toString().trim();
    const stampedMode = invoice.stripe_credential_mode as StripeCredentialMode | null;
    if (!orgId || !stampedMode) {
      // Legacy: can't safely target the right Stripe account — same refusal as revise.
      console.error('Stripe invoice has no stamped mode/org; refusing void', {
        invoiceId,
        stripeInvoiceId: invoice.stripe_invoice_id,
        hasOrg: Boolean(orgId),
        hasStampedMode: Boolean(stampedMode),
      });
      return jsonResponse({
        error: 'Stripe invoice predates per-org config; void it manually in the Stripe dashboard',
      }, 409);
    }

    let stripe: Awaited<ReturnType<typeof createReconciliationStripeClient>>['stripe'];
    try {
      ({ stripe } = await createReconciliationStripeClient(supabase, orgId, stampedMode));
    } catch (resolveErr) {
      const reason = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
      console.error('Failed to resolve Stripe credentials for void', {
        orgId,
        invoiceId,
        stampedMode,
        reason,
      });
      return jsonResponse({ error: 'Payment processing is not available for this organization' }, 503);
    }

    let stripeStatus: string | null = null;
    try {
      const existing = await stripe.invoices.retrieve(invoice.stripe_invoice_id);
      stripeStatus = existing.status ?? null;
    } catch (retrieveErr) {
      console.error('Could not retrieve Stripe invoice status', {
        invoiceId,
        stripeInvoiceId: invoice.stripe_invoice_id,
        retrieveErr,
      });
      return jsonResponse({ error: 'Could not verify the Stripe invoice status' }, 502);
    }

    if (stripeStatus === 'paid') {
      return jsonResponse({ error: 'Invoice is already paid — it can no longer be voided' }, 409);
    }

    if (stripeStatus === 'open' || stripeStatus === 'draft') {
      try {
        await stripe.invoices.voidInvoice(invoice.stripe_invoice_id);
        stripeStatus = 'void';
      } catch (voidErr) {
        console.error('Could not void Stripe invoice', {
          invoiceId,
          stripeInvoiceId: invoice.stripe_invoice_id,
          voidErr,
        });
        return jsonResponse({
          error: 'Could not void the Stripe invoice — nothing was changed. Please retry.',
        }, 502);
      }
    } else if (stripeStatus !== 'void' && stripeStatus !== 'uncollectible') {
      // Unexpected status — don't claim void when it isn't.
      console.error('Stripe invoice in unexpected state; not voided', {
        invoiceId,
        stripeInvoiceId: invoice.stripe_invoice_id,
        stripeStatus,
      });
      return jsonResponse({ error: `Stripe invoice is in state ${stripeStatus}; not voided` }, 409);
    }
    // Reaching here: just voided, or already void/uncollectible (idempotent success).

    // Stamp the confirmed-dead status ('void', or 'uncollectible' as-is — don't misreport).
    const warnings: string[] = [];
    const { error: statusErr } = await supabase
      .from('invoices')
      .update({
        stripe_invoice_status: stripeStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);
    if (statusErr) {
      // Stripe side is correct; Mason status self-heals via stripe-fetch-invoice sync.
      console.error('Failed to update invoice stripe_invoice_status after void', {
        invoiceId,
        statusErr,
      });
      warnings.push('invoice status update failed — will self-heal on next Stripe sync');
    }

    return jsonResponse({
      success: true,
      stripe_invoice_status: stripeStatus,
      ...(warnings.length > 0 ? { warning: warnings.join('; ') } : {}),
    });
  } catch (e) {
    console.error('stripe-void-invoice unexpected error', e);
    return jsonResponse({ error: 'Unexpected error' }, 500);
  }
});
