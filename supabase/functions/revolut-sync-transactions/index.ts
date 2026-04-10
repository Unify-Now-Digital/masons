import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-admin-token',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface RevolutTransaction {
  id: string;
  type: string;
  state: string;
  reference?: string;
  legs: Array<{
    amount: number;
    currency: string;
    description?: string;
    counterparty?: {
      account_id?: string;
      name?: string;
    };
  }>;
  created_at: string;
  completed_at?: string;
}

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Run matching logic for a Revolut payment against existing orders.
 * Returns match candidates with confidence levels.
 */
async function findMatchCandidates(
  supabase: SupabaseClient,
  amount: number,
  reference: string | null,
  counterpartyName: string | null
): Promise<{
  candidates: Array<{
    order_id: string;
    order_ref: string;
    customer_name: string;
    expected_amount: number;
    confidence: 'exact' | 'name' | 'amount';
    reason: string;
  }>;
  autoMatchOrderId: string | null;
  matchReason: string;
}> {
  const candidates: Array<{
    order_id: string;
    order_ref: string;
    customer_name: string;
    expected_amount: number;
    confidence: 'exact' | 'name' | 'amount';
    reason: string;
  }> = [];

  // Fetch orders with outstanding balance
  const { data: orders } = await supabase
    .from('orders_with_balance')
    .select('id, order_number, customer_name, total_order_value, amount_paid, balance_due, value')
    .gt('balance_due', 0);

  if (!orders?.length) {
    return { candidates: [], autoMatchOrderId: null, matchReason: 'No orders with outstanding balance' };
  }

  const refLower = (reference ?? '').toLowerCase();
  const nameLower = (counterpartyName ?? '').toLowerCase();

  for (const order of orders) {
    const orderRef = order.order_number ? String(order.order_number) : '';
    const custName = (order.customer_name ?? '').toLowerCase();
    const custSurname = custName.split(' ').pop() ?? '';
    const expectedAmount = Number(order.balance_due ?? order.total_order_value ?? order.value ?? 0);

    // Priority 1: reference contains order ref
    if (orderRef && refLower.includes(orderRef)) {
      candidates.push({
        order_id: order.id,
        order_ref: orderRef,
        customer_name: order.customer_name,
        expected_amount: expectedAmount,
        confidence: 'exact',
        reason: `Reference contains order #${orderRef}`,
      });
      continue;
    }

    // Priority 2: amount matches AND reference contains surname
    const amountMatch = Math.abs(amount - expectedAmount) < 0.01;
    const nameInRef = custSurname.length >= 3 && refLower.includes(custSurname);

    if (amountMatch && nameInRef) {
      candidates.push({
        order_id: order.id,
        order_ref: orderRef,
        customer_name: order.customer_name,
        expected_amount: expectedAmount,
        confidence: 'exact',
        reason: `Amount matches and reference contains "${custSurname}"`,
      });
      continue;
    }

    // Priority 3: name match in reference or counterparty
    const nameMatch = nameInRef || (custSurname.length >= 3 && nameLower.includes(custSurname));
    if (nameMatch) {
      candidates.push({
        order_id: order.id,
        order_ref: orderRef,
        customer_name: order.customer_name,
        expected_amount: expectedAmount,
        confidence: 'name',
        reason: `Customer surname "${custSurname}" found in ${nameInRef ? 'reference' : 'counterparty'}`,
      });
      continue;
    }

    // Priority 4: amount-only match
    if (amountMatch) {
      candidates.push({
        order_id: order.id,
        order_ref: orderRef,
        customer_name: order.customer_name,
        expected_amount: expectedAmount,
        confidence: 'amount',
        reason: `Amount ${amount} matches expected payment`,
      });
    }
  }

  // Sort by confidence priority
  const confidenceOrder = { exact: 0, name: 1, amount: 2 };
  candidates.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);

  // Auto-match if there's exactly one exact match
  const exactMatches = candidates.filter((c) => c.confidence === 'exact');
  const autoMatchOrderId = exactMatches.length === 1 ? exactMatches[0].order_id : null;
  const matchReason = autoMatchOrderId
    ? exactMatches[0].reason
    : candidates.length === 0
      ? 'No matching orders found'
      : 'Multiple candidates — manual review needed';

  return { candidates: candidates.slice(0, 5), autoMatchOrderId, matchReason };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get active Revolut connection
    const { data: connection, error: connErr } = await supabase
      .from('revolut_connections')
      .select('*')
      .eq('status', 'active')
      .single();

    if (connErr || !connection) {
      return jsonResponse({ error: 'No active Revolut connection' }, 404);
    }

    // Fetch recent transactions (last 30 days)
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);

    const txnRes = await fetch(
      `https://b2b.revolut.com/api/1.0/transactions?from=${fromDate.toISOString()}&type=transfer`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!txnRes.ok) {
      const errText = await txnRes.text();
      console.error('Revolut transactions fetch failed:', errText);
      return jsonResponse({ error: 'Failed to fetch transactions' }, 500);
    }

    const transactions = (await txnRes.json()) as RevolutTransaction[];
    let synced = 0;

    for (const txn of transactions) {
      if (txn.state !== 'completed') continue;

      const leg = txn.legs?.[0];
      if (!leg || leg.amount <= 0) continue; // Only incoming payments

      const externalId = txn.id;

      // Check idempotency
      const { data: existing } = await supabase
        .from('order_payments')
        .select('id')
        .eq('external_id', externalId)
        .maybeSingle();

      if (existing) continue;

      const amount = leg.amount;
      const reference = txn.reference ?? null;
      const counterpartyName = leg.counterparty?.name ?? null;

      // Run matching
      const { candidates, autoMatchOrderId, matchReason } = await findMatchCandidates(
        supabase,
        amount,
        reference,
        counterpartyName
      );

      const now = new Date().toISOString();
      const { error: insertErr } = await supabase.from('order_payments').insert({
        order_id: autoMatchOrderId,
        source: 'revolut',
        external_id: externalId,
        amount,
        currency: leg.currency ?? 'GBP',
        payment_type: autoMatchOrderId ? 'deposit' : null, // Default guess; user can change
        reference,
        match_reason: matchReason,
        match_candidates: candidates.length > 0 ? candidates : null,
        matched_at: autoMatchOrderId ? now : null,
        matched_by: autoMatchOrderId ? 'auto' : null,
        status: autoMatchOrderId ? 'matched' : 'unmatched',
        received_at: txn.completed_at ?? txn.created_at,
        raw_data: txn as unknown as Record<string, unknown>,
      });

      if (insertErr) {
        if (insertErr.code === '23505') continue; // unique violation = already exists
        console.error('Failed to insert Revolut payment:', insertErr);
        continue;
      }

      synced++;
    }

    return jsonResponse({ synced });
  } catch (err) {
    console.error('revolut-sync-transactions error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
