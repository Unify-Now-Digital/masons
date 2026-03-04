/**
 * Revise invoice flow (Option 1): void old Stripe invoice and create a new Mason invoice
 * with the same orders. New invoice gets revised_from_invoice_id and a note.
 * Client should then call stripe-create-invoice for the new invoice to create the Stripe invoice.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';

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

    const { data: oldInv, error: oldErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, amount, due_date, issue_date, user_id, stripe_invoice_id')
      .eq('id', oldInvoiceId)
      .single();

    if (oldErr || !oldInv) {
      return jsonResponse({ error: 'Invoice not found' }, 404);
    }

    // Void old Stripe invoice if present and open/draft
    if (oldInv.stripe_invoice_id) {
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
