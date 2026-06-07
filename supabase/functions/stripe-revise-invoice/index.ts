/**
 * Revise invoice flow (Option 1): void old Stripe invoice and create a new Mason invoice
 * with the same orders. New invoice gets revised_from_invoice_id and a note.
 * Client should then call stripe-create-invoice for the new invoice to create the Stripe invoice.
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

interface ReviseInvoiceRequest {
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

    let body: ReviseInvoiceRequest;
    try {
      body = (await req.json()) as ReviseInvoiceRequest;
    } catch {
      return jsonResponse({ error: 'Invalid JSON or missing body' }, 400);
    }

    const oldInvoiceId = body?.invoice_id?.trim();
    if (!oldInvoiceId) {
      return jsonResponse({ error: 'invoice_id is required' }, 400);
    }

    // No global STRIPE_SECRET_KEY — credentials resolve per-org from the old invoice's stamped mode.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: oldInv, error: oldErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, amount, due_date, issue_date, user_id, organization_id, stripe_credential_mode, stripe_invoice_id')
      .eq('id', oldInvoiceId)
      .single();

    if (oldErr || !oldInv) {
      return jsonResponse({ error: 'Invoice not found' }, 404);
    }

    // --- The revised invoice MUST carry the org forward, else stripe-create-invoice 422s on it.
    //     Require the source invoice to have an org. ---
    const rawOrgId = oldInv.organization_id;
    if (!rawOrgId || typeof rawOrgId !== 'string' || !rawOrgId.trim()) {
      console.error('Source invoice has no organization_id; cannot revise', oldInv.id);
      return jsonResponse({ error: 'Invoice is not associated with an organization' }, 422);
    }
    const orgId = rawOrgId.trim();

    // --- Void old Stripe invoice if present and open/draft (best-effort), in its stamped mode. ---
    if (oldInv.stripe_invoice_id) {
      const stampedMode = oldInv.stripe_credential_mode as StripeCredentialMode | null;
      if (!stampedMode) {
        // Legacy: we can't safely target the right account to void. Proceeding would leave the
        // old invoice OPEN and payable alongside the revision — a double-pay seam. Refuse;
        // staff must void the old Stripe invoice manually (or backfill the mode) first.
        console.error('Old Stripe invoice has no stamped mode; refusing revise', {
          oldInvoiceId,
          stripeInvoiceId: oldInv.stripe_invoice_id,
        });
        return jsonResponse({
          error: 'Old Stripe invoice predates per-org config; void it manually before revising',
        }, 409);
      }

      let stripe;
      try {
        ({ stripe } = await createReconciliationStripeClient(supabase, orgId, stampedMode));
      } catch (resolveErr) {
        const reason = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
        console.error('Failed to resolve Stripe credentials for void', { orgId, oldInvoiceId, stampedMode, reason });
        return jsonResponse({ error: 'Payment processing is not available for this organization' }, 503);
      }

      try {
        const existing = await stripe.invoices.retrieve(oldInv.stripe_invoice_id);
        if (existing.status === 'open' || existing.status === 'draft') {
          await stripe.invoices.voidInvoice(existing.id);
        }
      } catch (e) {
        console.warn('Could not void old Stripe invoice', e);
      }
      await supabase
        .from('invoices')
        .update({
          stripe_invoice_status: 'void',
          updated_at: new Date().toISOString(),
        })
        .eq('id', oldInvoiceId);
    }

    // Next invoice number
    let newInvoiceNumber: string;
    const { data: rpcNum } = await supabase.rpc('get_next_invoice_number');
    if (rpcNum && typeof rpcNum === 'string') {
      newInvoiceNumber = rpcNum;
    } else {
      const { data: maxRow } = await supabase
        .from('invoices')
        .select('invoice_number')
        .order('invoice_number', { ascending: false })
        .limit(1)
        .single();
      const match = maxRow?.invoice_number?.match(/\d+/);
      const nextNum = match ? parseInt(match[0], 10) + 1 : 1001;
      newInvoiceNumber = `INV-${String(nextNum).padStart(6, '0')}`;
    }

    const revisedNote = `Revised from ${oldInv.invoice_number}; previous payments on prior invoice.`;

    const { data: newInv, error: insertErr } = await supabase
      .from('invoices')
      .insert({
        invoice_number: newInvoiceNumber,
        customer_name: oldInv.customer_name,
        amount: oldInv.amount,
        due_date: oldInv.due_date,
        issue_date: new Date().toISOString().slice(0, 10),
        status: 'pending',
        organization_id: orgId, // carry org forward so the new invoice can get a Stripe invoice
        revised_from_invoice_id: oldInvoiceId,
        notes: revisedNote,
        user_id: oldInv.user_id ?? null,
      })
      .select('id, invoice_number')
      .single();

    if (insertErr || !newInv) {
      console.error('Failed to create new invoice', insertErr);
      return jsonResponse({ error: 'Failed to create revised invoice' }, 500);
    }

    // Reassign orders from old invoice to new invoice
    await supabase
      .from('orders')
      .update({ invoice_id: newInv.id, updated_at: new Date().toISOString() })
      .eq('invoice_id', oldInvoiceId);

    return jsonResponse({
      new_invoice_id: newInv.id,
      new_invoice_number: newInv.invoice_number,
      revised_from_invoice_id: oldInvoiceId,
    });
  } catch (e) {
    console.error('stripe-revise-invoice error', e);
    return jsonResponse({ error: 'Unexpected error' }, 500);
  }
});