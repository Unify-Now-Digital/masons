import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { isUserInOrganization } from '../_shared/organizationMembership.ts';
import {
  buildTaggedTranscript,
  fetchConversationMessages,
  type MsgRow,
} from '../_shared/conversationText.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-internal-key',
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Batch size when the caller names none. */
const K_DEFAULT = 15;
/** Hard ceiling on one sweep. Calls are sequential — a larger batch risks the edge wall-clock limit. */
const K_MAX = 25;
/** A scored conversation is re-ranked once it is this many days old. */
const REFRESH_DAYS = 7;
/** How long a claim is respected before another sweep may reclaim it (see tierOf). */
const CLAIM_TTL_MS = 10 * 60 * 1000;
/** Newest N messages included in the prompt. */
const MAX_MESSAGES_IN_PROMPT = 20;
/** Transcript hard cap (~2k tokens); oldest lines dropped first. */
const TRANSCRIPT_CHAR_CAP = 8000;
/** ai_reason is truncated to this at store time (no CHECK — a straggler must not hard-fail). */
const REASON_MAX_CHARS = 120;

const CATEGORIES = ['sales', 'support', 'admin', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

interface RequestBody {
  organization_id?: string;
  k?: number;
}

interface ConversationRow {
  id: string;
  last_message_at: string | null;
  ai_scored_at: string | null;
  ai_priority: number | null;
  order_id: string | null;
  enquiry_stage: string;
  channel: string;
}

interface Candidate {
  row: ConversationRow;
  tier: 1 | 2 | 3;
  lastMs: number;
  scoredMs: number;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface RankValue {
  priority: number;
  reason: string;
  category: Category;
}

/**
 * PostgREST/Supabase errors for the function logs.
 * message + code only: `details`/`hint` can echo a rejected value, and ai_reason
 * is model-written text that may name a customer (PII rule).
 */
function logDbError(context: string, err: unknown): void {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    console.error(`inbox-ai-rank ${context}`, JSON.stringify({ message: o.message, code: o.code }));
  } else {
    console.error(`inbox-ai-rank ${context}`, String(err));
  }
}

/** NaN for null/unparseable — never a silent 0 (epoch would sort as "oldest"). */
function parseMs(iso: string | null): number {
  if (!iso) return Number.NaN;
  return Date.parse(iso);
}

/** Descending by time with NaN (no timestamp) always last. */
function compareDescNaNLast(a: number, b: number): number {
  const aBad = Number.isNaN(a);
  const bBad = Number.isNaN(b);
  if (aBad && bBad) return 0;
  if (aBad) return 1;
  if (bBad) return -1;
  return b - a;
}

/**
 * FR-003 staleness tiers. All comparisons go through Date.parse — never string
 * compare (amendment [A3]).
 *   1  never scored (or an unparseable score time — treat as never)
 *   2  a message landed after the last score
 *   3  scored longer ago than REFRESH_DAYS
 *   0  fresh, or a live claim — not selectable
 *
 * Stale-claim recovery: ai_scored_at is stamped at claim time, before the rank is
 * written, so a crash or timeout mid-batch leaves a row with a score time and no
 * ai_priority. Left alone it would read as fresh for REFRESH_DAYS. Such a row is
 * therefore tier 1 once its claim is older than CLAIM_TTL_MS; inside the TTL it
 * stays tier 0 so a concurrent sweep does not double-score a claim still running.
 */
function tierOf(row: ConversationRow, nowMs: number, refreshCutoffMs: number): 0 | 1 | 2 | 3 {
  const scoredMs = parseMs(row.ai_scored_at);
  if (Number.isNaN(scoredMs)) return 1;

  if (row.ai_priority === null || row.ai_priority === undefined) {
    return scoredMs < nowMs - CLAIM_TTL_MS ? 1 : 0;
  }

  const lastMs = parseMs(row.last_message_at);
  if (!Number.isNaN(lastMs) && lastMs > scoredMs) return 2;
  if (scoredMs < refreshCutoffMs) return 3;
  return 0;
}

/** Human age for the facts block. */
function describeAge(iso: string | null, nowMs: number): string {
  const t = parseMs(iso);
  if (Number.isNaN(t)) return 'unknown time ago';
  const minutes = Math.max(0, Math.round((nowMs - t) / 60000));
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Parse + validate the model's JSON. Category falls back to 'other' (FR-007); everything else fails the row. */
function validateRank(raw: string): { ok: true; value: RankValue } | { ok: false; why: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, why: 'not JSON' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, why: 'not an object' };
  const o = parsed as Record<string, unknown>;

  const priority = o.priority;
  if (!Number.isInteger(priority) || (priority as number) < 0 || (priority as number) > 100) {
    return { ok: false, why: 'priority not an integer 0-100' };
  }

  const reason = typeof o.reason === 'string' ? o.reason.trim() : '';
  if (!reason) return { ok: false, why: 'reason empty' };

  const rawCategory = typeof o.category === 'string' ? o.category.trim().toLowerCase() : '';
  const category = (CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : 'other';

  return {
    ok: true,
    value: { priority: priority as number, reason: reason.slice(0, REASON_MAX_CHARS), category },
  };
}

/** The facts block + tagged transcript sent as the user message (FR-006 — facts, no formula). */
function buildUserContent(row: ConversationRow, messages: MsgRow[], nowMs: number): string {
  const last = messages[messages.length - 1];
  const lastDirection = last?.direction ?? 'unknown';
  const lastAt = last ? (last.sent_at ?? last.created_at) : null;
  const stage = row.enquiry_stage?.trim() ? row.enquiry_stage.trim() : 'none';
  const transcript = buildTaggedTranscript(messages, {
    maxMessages: MAX_MESSAGES_IN_PROMPT,
    charCap: TRANSCRIPT_CHAR_CAP,
  });

  return [
    'Facts about this conversation:',
    `- last message: ${lastDirection}, ${describeAge(lastAt, nowMs)}`,
    `- enquiry stage: ${stage}`,
    `- linked order: ${row.order_id ? 'yes' : 'no'}`,
    `- channel: ${row.channel}`,
    '',
    'Transcript (oldest to newest within this excerpt):',
    transcript,
  ].join('\n');
}

const SYSTEM_CONTENT =
  'You rank inbox conversations for a memorial masonry business so staff know which to handle first. Score how urgently a staff member needs to act now, 0–100 (higher = act sooner; around 70+ means the customer is waiting on us or there is a deadline; low means waiting on the customer or nothing to do). Base the score on the messages, weighted to the most recent. Output only valid JSON: {"priority": <integer 0-100>, "reason": <one sentence for the staff member naming what needs doing, max 120 characters>, "category": <"sales"|"support"|"admin"|"other">}. Do not invent details.';

/** One OpenAI call. Copy of inbox-ai-thread-summary/index.ts:545-561 — max_tokens 300 per amendment [A2]. */
async function callOpenAi(openaiKey: string, userContent: string): Promise<string | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_CONTENT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 300,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    console.error('inbox-ai-rank OpenAI error', res.status);
    return null;
  }
  const data = (await res.json()) as OpenAIChatResponse;
  return data?.choices?.[0]?.message?.content ?? null;
}

/** Give a claimed row back to the pool. Guarded so we only ever undo our own claim. */
async function restoreClaim(
  supabase: SupabaseClient,
  organizationId: string,
  conversationId: string,
  claimedScoredAt: string | null,
  previousScoredAt: string | null,
): Promise<void> {
  let q = supabase
    .from('inbox_conversations')
    .update({ ai_scored_at: previousScoredAt })
    .eq('id', conversationId)
    .eq('organization_id', organizationId);
  q = claimedScoredAt === null ? q.is('ai_scored_at', null) : q.eq('ai_scored_at', claimedScoredAt);
  const { error } = await q;
  if (error) logDbError(`restore id=${conversationId}`, error);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const expectedInternalKey = Deno.env.get('INTERNAL_FUNCTION_KEY') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    // Same auth model as inbox-ai-thread-summary:230-256 — valid user JWT OR internal key.
    // Unlike that function, we must know WHICH: the org is resolved from the caller (FR-009).
    let authUserId: string | null = null;
    let internalKeyOk = false;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, '').trim());
      if (!authError && user) authUserId = user.id;
    }
    if (!authUserId && expectedInternalKey) {
      const providedKey = req.headers.get('x-internal-key') ?? '';
      if (providedKey === expectedInternalKey) internalKeyOk = true;
    }
    if (!authUserId && !internalKeyOk) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON or missing body' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const bodyOrgId = typeof body.organization_id === 'string' ? body.organization_id.trim() : '';
    if (bodyOrgId && !UUID_REGEX.test(bodyOrgId)) {
      return new Response(JSON.stringify({ error: 'organization_id must be a valid UUID' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Org resolution (FR-009). The summary function has none — it reads the org off the
    // looked-up row, so any org's authenticated user can reach any org's data.
    let organizationId: string;
    if (authUserId) {
      if (bodyOrgId) {
        const member = await isUserInOrganization(supabase, authUserId, bodyOrgId);
        if (!member) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: jsonHeaders,
          });
        }
        organizationId = bodyOrgId;
      } else {
        // Backstop only — the sweep hook always sends organization_id (amendment [A1]).
        const { data: memberships, error: membershipErr } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', authUserId)
          .limit(2);
        if (membershipErr) {
          logDbError('organization_members lookup', membershipErr);
          return new Response(JSON.stringify({ error: 'Failed to resolve organization' }), {
            status: 500,
            headers: jsonHeaders,
          });
        }
        const rows = (memberships ?? []) as Array<{ organization_id: string }>;
        if (rows.length === 0) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: jsonHeaders,
          });
        }
        if (rows.length > 1) {
          return new Response(
            JSON.stringify({ error: 'organization_id is required for multi-organization users' }),
            { status: 400, headers: jsonHeaders },
          );
        }
        organizationId = rows[0].organization_id;
      }
    } else {
      if (!bodyOrgId) {
        return new Response(JSON.stringify({ error: 'organization_id is required' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
      organizationId = bodyOrgId;
    }

    const k = Number.isInteger(body.k) && (body.k as number) > 0
      ? Math.min(body.k as number, K_MAX)
      : Math.min(K_DEFAULT, K_MAX);

    // Selection (FR-002). One FK path inbox_messages -> inbox_conversations
    // (pg_constraint, verified 2026-09-10), so the !inner embed needs no FK-name hint.
    // The embed filters AND, so this keeps only conversations with >=1 non-empty body;
    // limit 1 on the embed bounds the payload. The single .order() makes PostgREST's
    // db-max-rows truncation deterministic (newest first) rather than arbitrary.
    const { data: convData, error: convErr } = await supabase
      .from('inbox_conversations')
      .select(
        'id, last_message_at, ai_scored_at, ai_priority, order_id, enquiry_stage, channel, inbox_messages!inner(id)',
      )
      .eq('organization_id', organizationId)
      .eq('status', 'open')
      .not('inbox_messages.body_text', 'is', null)
      .neq('inbox_messages.body_text', '')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1, { foreignTable: 'inbox_messages' });

    if (convErr) {
      logDbError(`conversation selection org=${organizationId}`, convErr);
      return new Response(JSON.stringify({ error: 'Failed to load conversations' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const nowMs = Date.now();
    const refreshCutoffMs = nowMs - REFRESH_DAYS * 24 * 60 * 60 * 1000;
    const rows = (convData ?? []) as unknown as ConversationRow[];

    const candidates: Candidate[] = [];
    for (const row of rows) {
      const tier = tierOf(row, nowMs, refreshCutoffMs);
      if (tier === 0) continue;
      candidates.push({
        row,
        tier,
        lastMs: parseMs(row.last_message_at),
        scoredMs: parseMs(row.ai_scored_at),
      });
    }

    // FR-003 order: tier asc; tiers 1-2 newest message first, tier 3 oldest score first.
    candidates.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.tier === 3) return a.scoredMs - b.scoredMs;
      return compareDescNaNLast(a.lastMs, b.lastMs);
    });

    const batch = candidates.slice(0, k);

    // Empty selection: no AI call, and the backfill loop's stop condition (FR-004).
    if (batch.length === 0) {
      return new Response(JSON.stringify({ selected: 0, written: 0, failed: 0 }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const sweepIso = new Date().toISOString();
    let written = 0;
    let failed = 0;
    let selected = 0;

    for (const candidate of batch) {
      const { row } = candidate;
      const previousScoredAt = row.ai_scored_at;

      // Optimistic claim: stamp ai_scored_at only if nobody else moved it since we read it.
      // The equality uses the string exactly as PostgREST returned it, never a re-formatted
      // Date (amendment [A3]).
      let claimQuery = supabase
        .from('inbox_conversations')
        .update({ ai_scored_at: sweepIso })
        .eq('id', row.id)
        .eq('organization_id', organizationId);
      claimQuery =
        previousScoredAt === null
          ? claimQuery.is('ai_scored_at', null)
          : claimQuery.eq('ai_scored_at', previousScoredAt);

      const { data: claimedRows, error: claimErr } = await claimQuery.select('id, ai_scored_at');
      if (claimErr) {
        logDbError(`claim id=${row.id}`, claimErr);
        failed += 1;
        continue;
      }
      const claimed = (claimedRows ?? []) as Array<{ id: string; ai_scored_at: string | null }>;
      // Zero rows: another sweep claimed it first — drop it, this is not a failure.
      if (claimed.length === 0) continue;

      selected += 1;
      const claimedScoredAt = claimed[0].ai_scored_at;

      const { messages, error: msgErr } = await fetchConversationMessages(supabase, row.id);
      if (msgErr || messages.length === 0) {
        if (msgErr) logDbError(`messages conversation_id=${row.id}`, msgErr);
        await restoreClaim(supabase, organizationId, row.id, claimedScoredAt, previousScoredAt);
        failed += 1;
        continue;
      }

      let rawContent: string | null = null;
      try {
        rawContent = await callOpenAi(openaiKey, buildUserContent(row, messages, nowMs));
      } catch (err) {
        console.error(`inbox-ai-rank openai call id=${row.id}`, String(err));
        rawContent = null;
      }

      if (!rawContent) {
        await restoreClaim(supabase, organizationId, row.id, claimedScoredAt, previousScoredAt);
        failed += 1;
        continue;
      }

      const validated = validateRank(rawContent);
      if (!validated.ok) {
        console.error(`inbox-ai-rank invalid rank id=${row.id} why=${validated.why}`);
        await restoreClaim(supabase, organizationId, row.id, claimedScoredAt, previousScoredAt);
        failed += 1;
        continue;
      }

      // All four fields together or none (FR-004) — never a partial write.
      const { error: writeErr } = await supabase
        .from('inbox_conversations')
        .update({
          ai_priority: validated.value.priority,
          ai_reason: validated.value.reason,
          ai_category: validated.value.category,
          ai_scored_at: sweepIso,
        })
        .eq('id', row.id)
        .eq('organization_id', organizationId);

      if (writeErr) {
        logDbError(`rank write id=${row.id}`, writeErr);
        await restoreClaim(supabase, organizationId, row.id, claimedScoredAt, previousScoredAt);
        failed += 1;
        continue;
      }

      written += 1;
    }

    return new Response(JSON.stringify({ selected, written, failed }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error('inbox-ai-rank unhandled', String(err));
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
