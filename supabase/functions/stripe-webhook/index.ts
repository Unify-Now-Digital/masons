import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, stripe-signature',
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!webhookSecret || !stripeSecret) {
    console.error('STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY not set');
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const signature = req.headers.get('stripe-signature') ?? req.headers.get('Stripe-Signature');
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing Stripe-Signature' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    console.error('Failed to read webhook body', e);
    return new Response(JSON.stringify({ error: 'Invalid body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let event: Stripe.Event;

  const stripe = new Stripe(stripeSecret);

  try {
  event = await stripe.webhooks.constructEventAsync(
    rawBody,
    signature,
    webhookSecret
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature';
    console.error('Stripe webhook signature verification failed:', msg);

  return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }


  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  let invoiceId: string | null = (session.metadata?.invoice_id as string) ?? null;
  const paymentIntent = session.payment_intent;
  if (!invoiceId && paymentIntent && typeof paymentIntent === 'object' && paymentIntent.metadata?.invoice_id) {
    invoiceId = paymentIntent.metadata.invoice_id as string;
  }
  if (!invoiceId) {
    console.error('checkout.session.completed: no invoice_id in metadata');
    return new Response(JSON.stringify({ error: 'Missing invoice_id in session metadata' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase URL or SERVICE_ROLE_KEY missing');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, stripe_status')
    .eq('id', invoiceId)
    .single();

  if (!existing) {
    console.error('Webhook: invoice not found', invoiceId);
    return new Response(JSON.stringify({ error: 'Invoice not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (existing.stripe_status === 'paid') {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const paymentIntentId = typeof paymentIntent === 'string'
    ? paymentIntent
    : (paymentIntent?.id ?? null);

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    stripe_status: 'paid',
    paid_at: now,
    status: 'paid',
    updated_at: now,
    payment_date: now.slice(0, 10),
    payment_method: 'Stripe',
  };
  if (paymentIntentId) updates.stripe_payment_intent_id = paymentIntentId;
  if (session.id) updates.stripe_checkout_session_id = session.id;

  const { error: updateErr } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', invoiceId);

  if (updateErr) {
    console.error('Failed to update invoice to paid', updateErr);
    return new Response(JSON.stringify({ error: 'Failed to update invoice' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
