import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-admin-token',
};

interface DeleteInvoiceRequest {
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
    // Auth via admin token, consistent with other Stripe functions
    const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');
    if (!expectedToken || !adminToken || adminToken !== expectedToken) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: DeleteInvoiceRequest;
    try {
      body = (await req.json()) as DeleteInvoiceRequest;
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

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

    // Load invoice with Stripe metadata
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, stripe_invoice_id, stripe_invoice_status, deleted_at')
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice) {
      return jsonResponse({ error: 'Invoice not found' }, 404);
    }

    // If already soft-deleted, treat as success (idempotent)
    if ((invoice as { deleted_at?: string | null }).deleted_at) {
      return jsonResponse({ success: true }, 200);
    }

    // Best-effort: void Stripe invoice if still open/draft
    if (stripe && invoice.stripe_invoice_id) {
      try {
        const si = await stripe.invoices.retrieve(invoice.stripe_invoice_id);
        if (si.status === 'draft' || si.status === 'open') {
          await stripe.invoices.voidInvoice(si.id);
        }
      } catch (err) {
        console.error('Failed to void Stripe invoice before delete', err);
        // Do not block local delete on Stripe error
      }
    }

    // Soft delete invoice row (do not remove related orders or payments)
    const { error: delErr } = await supabase
      .from('invoices')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    if (delErr) {
      console.error('Failed to delete invoice', delErr);
      return jsonResponse({ error: 'Failed to delete invoice' }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (e) {
    console.error('invoices-delete unexpected error', e);
    return jsonResponse({ error: 'Unexpected error' }, 500);
  }
});

