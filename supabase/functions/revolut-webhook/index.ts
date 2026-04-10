import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, revolut-signature, revolut-request-timestamp',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Security: HMAC SHA-256 signature verification
// ---------------------------------------------------------------------------
async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Revolut sends signature as hex
  const hexPairs = signature.match(/.{2}/g);
  if (!hexPairs) return false;
  const sigBytes = new Uint8Array(hexPairs.map((b) => parseInt(b, 16)));

  return crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(rawBody)
  );
}

// ---------------------------------------------------------------------------
// Security: Replay attack protection via timestamp check
// ---------------------------------------------------------------------------
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000; // 5 minutes

function isTimestampFresh(timestampHeader: string | null): boolean {
  if (!timestampHeader) return false;
  const ts = new Date(timestampHeader).getTime();
  if (isNaN(ts)) return false;
  const age = Math.abs(Date.now() - ts);
  return age <= MAX_WEBHOOK_AGE_MS;
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    id: string;
    type: string;
    state: string;
    reference?: string;
    legs?: Array<{
      amount: number;
      currency: string;
      counterparty?: {
        name?: string;
      };
    }>;
    created_at: string;
    completed_at?: string;
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  // --- Step 1: Read raw body before anything else ---
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return jsonResponse({ error: 'Invalid body' }, 400);
  }

  // --- Step 2: Replay protection — reject stale webhooks ---
  const requestTimestamp =
    req.headers.get('revolut-request-timestamp') ??
    req.headers.get('Revolut-Request-Timestamp');
  if (!isTimestampFresh(requestTimestamp)) {
    console.error('Revolut webhook rejected: stale or missing timestamp', requestTimestamp);
    return jsonResponse({ error: 'Stale webhook — timestamp too old or missing' }, 400);
  }

  // --- Step 3: Signature verification (MUST happen before any DB/matching logic) ---
  const signature =
    req.headers.get('revolut-signature') ??
    req.headers.get('Revolut-Signature') ?? '';
  if (!signature) {
    return jsonResponse({ error: 'Missing Revolut-Signature header' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch signing secret from active connection
  const { data: connection } = await supabase
    .from('revolut_connections')
    .select('webhook_signing_secret')
    .eq('status', 'active')
    .single();

  if (!connection?.webhook_signing_secret) {
    console.error('No Revolut webhook signing secret configured');
    return jsonResponse({ error: 'Webhook not configured' }, 500);
  }

  const valid = await verifySignature(rawBody, signature, connection.webhook_signing_secret);
  if (!valid) {
    console.error('Revolut webhook signature verification FAILED');
    return jsonResponse({ error: 'Invalid signature' }, 400);
  }

  // --- Step 4: Parse verified payload ---
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { event, data: txn } = payload;

  // --- Step 5: Idempotency — deduplicate by external_id (UNIQUE constraint) ---
  // The external_id column has a UNIQUE constraint, so even if this check
  // races, the INSERT will fail with 23505 and we handle that gracefully.

  if (event === 'TransactionCreated') {
    const leg = txn.legs?.[0];
    if (!leg || leg.amount <= 0) {
      return jsonResponse({ received: true }); // Outgoing or zero amount — skip
    }

    const externalId = txn.id;

    // Idempotency: check before expensive matching logic
    const { data: existing } = await supabase
      .from('order_payments')
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle();

    if (existing) {
      return jsonResponse({ received: true, duplicate: true });
    }

    // --- Matching logic ---
    const reference = txn.reference ?? null;
    const counterpartyName = leg.counterparty?.name ?? null;

    const { data: orders } = await supabase
      .from('orders_with_balance')
      .select('id, order_number, customer_name, balance_due, total_order_value, value')
      .gt('balance_due', 0);

    let autoMatchOrderId: string | null = null;
    let matchReason = 'No matching orders found';
    const candidates: Array<Record<string, unknown>> = [];
    const refLower = (reference ?? '').toLowerCase();
    const nameLower = (counterpartyName ?? '').toLowerCase();

    if (orders?.length) {
      for (const order of orders) {
        const orderRef = order.order_number ? String(order.order_number) : '';
        const custSurname = (order.customer_name ?? '').toLowerCase().split(' ').pop() ?? '';
        const expectedAmount = Number(order.balance_due ?? order.total_order_value ?? order.value ?? 0);
        const amountMatch = Math.abs(leg.amount - expectedAmount) < 0.01;
        const nameInRef = custSurname.length >= 3 && refLower.includes(custSurname);
        const nameInCounterparty = custSurname.length >= 3 && nameLower.includes(custSurname);
        const refHasOrderNum = orderRef && refLower.includes(orderRef);

        if (refHasOrderNum || (amountMatch && (nameInRef || nameInCounterparty))) {
          candidates.push({
            order_id: order.id,
            order_ref: orderRef,
            customer_name: order.customer_name,
            expected_amount: expectedAmount,
            confidence: 'exact',
            reason: refHasOrderNum ? `Reference contains #${orderRef}` : 'Amount + name match',
          });
        } else if (nameInRef || nameInCounterparty) {
          candidates.push({
            order_id: order.id,
            order_ref: orderRef,
            customer_name: order.customer_name,
            expected_amount: expectedAmount,
            confidence: 'name',
            reason: `Name match: "${custSurname}"`,
          });
        } else if (amountMatch) {
          candidates.push({
            order_id: order.id,
            order_ref: orderRef,
            customer_name: order.customer_name,
            expected_amount: expectedAmount,
            confidence: 'amount',
            reason: `Amount match: ${leg.amount}`,
          });
        }
      }

      const exactMatches = candidates.filter((c) => c.confidence === 'exact');
      if (exactMatches.length === 1) {
        autoMatchOrderId = exactMatches[0].order_id as string;
        matchReason = exactMatches[0].reason as string;
      } else if (candidates.length > 0) {
        matchReason = 'Multiple candidates — manual review needed';
      }
    }

    const now = new Date().toISOString();
    const { error: insertErr } = await supabase.from('order_payments').insert({
      order_id: autoMatchOrderId,
      source: 'revolut',
      external_id: externalId,
      amount: leg.amount,
      currency: leg.currency ?? 'GBP',
      reference,
      match_reason: matchReason,
      match_candidates: candidates.length > 0 ? candidates : null,
      matched_at: autoMatchOrderId ? now : null,
      matched_by: autoMatchOrderId ? 'auto' : null,
      status: autoMatchOrderId ? 'matched' : 'unmatched',
      received_at: txn.completed_at ?? txn.created_at,
      raw_data: payload as unknown as Record<string, unknown>,
    });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return jsonResponse({ received: true, duplicate: true }); // Idempotent
      }
      console.error('Failed to insert Revolut payment:', insertErr);
      return jsonResponse({ error: 'Failed to record payment' }, 500);
    }

    return jsonResponse({ received: true });
  }

  if (event === 'TransactionStateChanged') {
    if (txn.state === 'reverted' || txn.state === 'declined' || txn.state === 'failed') {
      await supabase
        .from('order_payments')
        .update({ status: 'dismissed' })
        .eq('external_id', txn.id);
    }
    return jsonResponse({ received: true });
  }

  // Unknown event — acknowledge
  return jsonResponse({ received: true });
});
