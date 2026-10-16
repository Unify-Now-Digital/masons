/**
 * ask-ai — page-aware, strictly READ-ONLY question answering for the shell's
 * bottom bar (Mason UI phase 2). Body: { page, question, organization_id }.
 *
 * - Auth: caller's JWT is required (no internal-key path: this is a user feature).
 * - All reads go through a client carrying the caller's JWT, so RLS applies;
 *   membership is also checked explicitly before any read.
 * - Only SELECTs. No inserts/updates/deletes, no sends, no caching table.
 * - Context is capped (row limits + MAX_CONTEXT_CHARS) and OpenAI has a timeout.
 * - Uses the same OPENAI_API_KEY secret and gpt-4o-mini model as inbox-ai-*.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import {
  buildMessages,
  buildOpenAiPayload,
  MAX_FETCH_ROWS,
  OPENAI_TIMEOUT_MS,
  serialiseContext,
  redactMoney,
  summariseFinance,
  summariseOrders,
  summarisePipeline,
  validateAskAiBody,
  type AskAiPage,
  type BalanceRow,
  type InvoiceRow,
  type JobRow,
  type OrderRow,
} from './context.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

async function loadContext(
  db: SupabaseClient,
  page: AskAiPage,
  orgId: string,
  todayIso: string,
  isOwner: boolean,
): Promise<Record<string, unknown>> {
  if (page === 'orders') {
    const { data, error } = await db
      .from('orders')
      .select('order_number, customer_name, due_date, installation_date, progress, stone_status, permit_status, proof_status')
      .eq('organization_id', orgId)
      .lt('progress', 100)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(MAX_FETCH_ROWS);
    if (error) throw error;
    return summariseOrders((data ?? []) as OrderRow[], todayIso);
  }
  if (page === 'pipeline') {
    const { data, error } = await db
      .from('jobs')
      .select('stage, exit_reason')
      .eq('organization_id', orgId)
      .not('stage', 'is', null)
      .order('created_at', { ascending: false })
      .limit(MAX_FETCH_ROWS);
    if (error) throw error;
    return summarisePipeline((data ?? []) as JobRow[]);
  }
  if (!isOwner) {
    return {
      finance_hidden: true,
      note: 'Amounts are hidden. Say that only the owner can see money. Do not invent figures.',
    };
  }
  const [inv, bal] = await Promise.all([
    db
      .from('invoices')
      .select('invoice_number, customer_name, amount, amount_remaining, status, due_date')
      .eq('organization_id', orgId)
      .not('status', 'in', '(paid,cancelled)')
      .order('due_date', { ascending: true })
      .limit(MAX_FETCH_ROWS),
    db
      .from('orders_with_balance')
      .select('order_number, customer_name, balance_due, installation_date')
      .eq('organization_id', orgId)
      .gt('balance_due', 0)
      .order('installation_date', { ascending: true, nullsFirst: false })
      .limit(MAX_FETCH_ROWS),
  ]);
  if (inv.error) throw inv.error;
  if (bal.error) throw bal.error;
  return summariseFinance((inv.data ?? []) as InvoiceRow[], (bal.data ?? []) as BalanceRow[], todayIso);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return reply(405, { error: 'Method Not Allowed' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
    if (!supabaseUrl || !anonKey) return reply(500, { error: 'Server configuration error' });
    if (!openaiKey) return reply(503, { error: 'Ask AI is not configured' });

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return reply(401, { error: 'Unauthorized' });
    // User-scoped client: every query below runs under the caller's RLS.
    const db = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await db.auth.getUser(
      authHeader.replace(/^Bearer\s+/i, '').trim(),
    );
    if (authError || !user) return reply(401, { error: 'Unauthorized' });

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return reply(400, { error: 'Invalid JSON or missing body' });
    }
    const parsed = validateAskAiBody(raw);
    if (!parsed.ok) return reply(400, { error: parsed.error });
    const { page, question, organization_id: orgId } = parsed.value;

    const { data: membership, error: memberError } = await db
      .from('organization_members')
      .select('role, is_owner')
      .eq('user_id', user.id)
      .eq('organization_id', orgId)
      .maybeSingle();
    if (memberError || !membership) return reply(403, { error: 'Forbidden' });
    // Same rule as the database helper (owner, or admin/member when the org has no owner).
    const { data: canSee } = await db.rpc('user_can_view_org_finance', { p_org: orgId });
    const isOwner = canSee === true;

    const todayIso = new Date().toISOString().slice(0, 10);
    let context: Record<string, unknown>;
    try {
      context = await loadContext(db, page, orgId, todayIso, isOwner);
    } catch (err) {
      console.error('ask-ai context error', page, (err as { message?: string })?.message ?? String(err));
      return reply(500, { error: 'Could not load page data' });
    }
    const contextJson = serialiseContext(context);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    let openaiRes: Response;
    try {
      openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify(buildOpenAiPayload(buildMessages(page, question, contextJson, todayIso, !isOwner))),
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = (err as { name?: string })?.name === 'AbortError';
      console.error('ask-ai openai fetch failed', aborted ? 'timeout' : String(err));
      return reply(aborted ? 504 : 502, { error: aborted ? 'Mason AI took too long to answer' : 'Mason AI is unavailable' });
    } finally {
      clearTimeout(timer);
    }
    if (!openaiRes.ok) {
      console.error('ask-ai openai error', openaiRes.status, (await openaiRes.text()).slice(0, 500));
      return reply(502, { error: 'Mason AI is unavailable' });
    }
    const data = (await openaiRes.json()) as OpenAIChatResponse;
    const rawAnswer = data?.choices?.[0]?.message?.content?.trim();
    if (!rawAnswer) return reply(502, { error: 'Mason AI returned no answer' });
    const answer = isOwner ? rawAnswer : redactMoney(rawAnswer);

    return reply(200, { answer, page, context_chars: contextJson.length });
  } catch (err) {
    console.error('ask-ai unexpected', String(err));
    return reply(500, { error: 'Unexpected error' });
  }
});
