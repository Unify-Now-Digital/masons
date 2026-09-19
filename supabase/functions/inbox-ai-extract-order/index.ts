/**
 * inbox-ai-extract-order (spec FR-010..FR-015, plan C3). Reads the caller's chosen
 * conversations and returns up to seven order-form fields, each with a verbatim
 * evidence quote the server has checked against the transcript.
 *
 * Auth: user JWT only (R-008), no internal-key path; deployed with verify_jwt on.
 * Tenant isolation: the org comes from the body and membership is checked before any
 * table read; conversations are loaded by id AND that org, and only the ids that came
 * back (`ownedIds`) are read further. fetchConversationMessages has no org filter of
 * its own, so `ownedIds` is the whole guard (T033).
 * Logs: ids, counts, durations, and error codes, statuses or classes only (FR-015).
 * Never message, person or model text, and never a raw error.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { isUserInOrganization } from '../_shared/organizationMembership.ts';
import {
  buildTaggedTranscript,
  fetchConversationMessages,
  sortMessagesLikeUnifiedTimeline,
  type MsgRow,
} from '../_shared/conversationText.ts';
import {
  FIELD_NAMES,
  dropLinkedPersonName,
  filterByEvidence,
  type ExtractedFields,
} from '../_shared/evidenceFilter.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

/** Shape check only; ownership is enforced by the org-scoped conversation query. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** FR-010: at most this many conversations per call. */
const MAX_CONVERSATIONS = 10;
/** Window (FR-012, D-6): the oldest KEEP_HEAD messages plus the newest 28. */
const MAX_MESSAGES_IN_PROMPT = 30;
const KEEP_HEAD = 2;
/** Transcript hard cap (~3k tokens). */
const TRANSCRIPT_CHAR_CAP = 12000;
/** D-10: the worst-case reply (seven fields at their caps) is ~1286 tokens. */
const MAX_TOKENS = 1500;
/** D-10: long enough for a full MAX_TOKENS reply. */
const OPENAI_TIMEOUT_MS = 30_000;

const LOG = 'inbox-ai-extract-order';

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { completion_tokens?: number };
}

type ModelResult = { ok: true; content: string; completionTokens: number | null } | { ok: false };

/**
 * inbox-ai-rank's logDbError narrowed to the code only: `message`, `details` and `hint`
 * can all echo a value. A non-object error logs its type only, never its text (FR-015).
 */
function logDbError(context: string, err: unknown): void {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    console.error(`${LOG} ${context}`, JSON.stringify({ code: o.code }));
  } else {
    console.error(`${LOG} ${context}`, typeof err);
  }
}

/** Error class only: an Error's message can quote a response body (FR-015). */
function errorClass(err: unknown): string {
  return err instanceof Error ? err.name : typeof err;
}

function allNull(): ExtractedFields {
  return Object.fromEntries(FIELD_NAMES.map((name) => [name, null])) as ExtractedFields;
}

const SYSTEM_CONTENT = [
  'You read a conversation between a memorial masonry business and a customer and fill in an order form.',
  'Output only a JSON object with exactly these keys: customer_name, location, sku, order_type, material, color, inscription_text.',
  'Each key is either null or {"value": <string>, "evidence": <string>}.',
  'customer_name: full name of the deceased person the memorial is for. Never the customer or sender; lines beginning "From:", "Email:" or "Phone:" describe the customer, not the deceased. Max 80 characters.',
  'location: the cemetery, churchyard or address where the memorial is to be installed. Max 120 characters.',
  'sku: the grave or plot number. Max 40 characters.',
  'order_type: exactly "New Memorial" or "Renovation".',
  'material: the stone type, e.g. black granite. Max 60 characters.',
  'color: the stone colour. Max 40 characters.',
  'inscription_text: the inscription wording exactly as the customer wrote it. Max 600 characters.',
  'evidence: the shortest span copied character for character from the transcript that shows the value; for customer_name and sku it must contain the value itself. Max 200 characters (600 for inscription_text).',
  'Use null for anything not stated explicitly. Do not guess, infer or combine.',
].join('\n');

/** One OpenAI call with an abort timeout (D-10). Logs a status, an error class or a constant. */
async function callOpenAi(openaiKey: string, transcript: string): Promise<ModelResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
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
          {
            role: 'user',
            content: `Transcript (oldest to newest; a "[…]" line marks omitted messages):\n${transcript}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: MAX_TOKENS,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`${LOG} OpenAI error`, res.status);
      return { ok: false };
    }
    const data = (await res.json()) as OpenAIChatResponse;
    const choice = data?.choices?.[0];
    const tokens = data?.usage?.completion_tokens;
    const completionTokens = typeof tokens === 'number' ? tokens : null;
    // D-10: a reply cut at max_tokens is a parse failure. Log the constant, never content.
    if (choice?.finish_reason === 'length') {
      console.error(`${LOG} finish: length`, JSON.stringify({ completion_tokens: completionTokens }));
      return { ok: false };
    }
    const content = choice?.message?.content;
    if (!content) {
      console.error(`${LOG} empty model reply`);
      return { ok: false };
    }
    return { ok: true, content, completionTokens };
  } catch (err) {
    console.error(`${LOG} OpenAI call failed`, controller.signal.aborted ? 'timeout' : errorClass(err));
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: jsonHeaders });

  if (req.method !== 'POST') return respond(405, { error: 'Method Not Allowed' });

  const startedMs = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return respond(500, { error: 'Server configuration error' });
    }

    // User JWT only (R-008), server-verified with auth.getUser as in inbox-ai-rank.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return respond(401, { error: 'Unauthorized' });
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, '').trim());
    if (authError || !user) return respond(401, { error: 'Unauthorized' });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return respond(400, { error: 'Invalid JSON or missing body' });
    }
    const { organization_id: rawOrgId, conversation_ids: rawIds } = (body ?? {}) as Record<string, unknown>;

    const organizationId = typeof rawOrgId === 'string' ? rawOrgId.trim().toLowerCase() : '';
    if (!UUID_REGEX.test(organizationId)) {
      return respond(400, { error: 'organization_id must be a valid UUID' });
    }
    const requestedIds = Array.isArray(rawIds)
      ? [...new Set(rawIds.map((id) => (typeof id === 'string' ? id.trim().toLowerCase() : '')))]
      : [];
    if (
      requestedIds.length === 0 ||
      requestedIds.length > MAX_CONVERSATIONS ||
      !requestedIds.every((id) => UUID_REGEX.test(id))
    ) {
      return respond(400, { error: `conversation_ids must be 1-${MAX_CONVERSATIONS} UUIDs` });
    }
    const requestedCount = requestedIds.length;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // FR-011: membership BEFORE any table read. The org is the body's, never a row's.
    // `false` also means the lookup itself failed: the shared helper returns false on a query
    // error and logs nothing, so "membership: denied" can be a database outage.
    const member = await isUserInOrganization(supabase, user.id, organizationId);
    if (!member) {
      console.warn(
        `${LOG} membership: denied`,
        JSON.stringify({ user_id: user.id, organization_id: organizationId }),
      );
      return respond(403, { error: 'Forbidden' });
    }

    const { data: convData, error: convErr } = await supabase
      .from('inbox_conversations')
      .select('id, person_id')
      .in('id', requestedIds)
      .eq('organization_id', organizationId);
    if (convErr) {
      logDbError(`conversations org=${organizationId}`, convErr);
      return respond(500, { error: 'Failed to load conversations' });
    }
    const rows = (convData ?? []) as Array<{ id: string; person_id: string | null }>;
    const ownedIds = rows.map((r) => r.id);
    // From here on only ownedIds are read; the body's ids are never used again (T040).

    // FR-014a names. Skipped when no conversation is linked to a person.
    const personIds = [...new Set(rows.map((r) => r.person_id).filter((id): id is string => !!id))];
    let linkedNames: string[] = [];
    let namesFailed = false;
    if (personIds.length > 0) {
      const { data: peopleData, error: peopleErr } = await supabase
        .from('people')
        .select('first_name, last_name')
        .in('id', personIds)
        .eq('organization_id', organizationId);
      if (peopleErr) {
        logDbError(`people org=${organizationId}`, peopleErr);
        namesFailed = true;
      } else {
        const people = (peopleData ?? []) as Array<{ first_name: string | null; last_name: string | null }>;
        linkedNames = people.map((p) => `${p.first_name ?? ''} ${p.last_name ?? ''}`);
      }
    }

    // fetchConversationMessages takes one id; ownedIds holds at most MAX_CONVERSATIONS.
    const settled = await Promise.allSettled(
      ownedIds.map((id) => fetchConversationMessages(supabase, id)),
    );
    const collected: MsgRow[] = [];
    let failedConversations = 0;
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled' && !result.value.error) {
        collected.push(...result.value.messages);
        return;
      }
      // D-8: skip this conversation, log its id and the error code, keep the rest.
      failedConversations += 1;
      const code =
        result.status === 'fulfilled'
          ? ((result.value.error as { code?: unknown } | null)?.code ?? 'unknown')
          : errorClass(result.reason);
      console.error(`${LOG} messages skipped`, JSON.stringify({ conversation_id: ownedIds[i], code }));
    });
    const messages = sortMessagesLikeUnifiedTimeline(collected);

    const transcript = buildTaggedTranscript(messages, {
      maxMessages: MAX_MESSAGES_IN_PROMPT,
      charCap: TRANSCRIPT_CHAR_CAP,
      keepHead: KEEP_HEAD,
    });
    const counts = {
      organization_id: organizationId,
      requested: requestedCount,
      returned: ownedIds.length,
      failed: failedConversations,
      messages: messages.length,
    };

    // Nothing to read: all seven keys null, no model call.
    if (transcript === '') {
      console.log(`${LOG} done`, JSON.stringify({ ...counts, model: false, ms: Date.now() - startedMs }));
      return respond(200, { fields: allNull() });
    }

    if (!openaiKey) return respond(500, { error: 'AI not configured' });

    const model = await callOpenAi(openaiKey, transcript);
    if (!model.ok) return respond(502, { error: 'Extraction failed' });

    let parsed: unknown;
    try {
      parsed = JSON.parse(model.content);
    } catch (err) {
      // Error class only: a SyntaxError message quotes part of the model output.
      console.error(`${LOG} parse failure`, errorClass(err));
      return respond(502, { error: 'Extraction failed' });
    }

    let fields = filterByEvidence(parsed, transcript);
    // FR-014a. If the names could not be read, fail safe and drop customer_name outright.
    fields = namesFailed ? { ...fields, customer_name: null } : dropLinkedPersonName(fields, linkedNames);

    const kept = FIELD_NAMES.filter((name) => fields[name] !== null).length;
    console.log(
      `${LOG} done`,
      JSON.stringify({
        ...counts,
        kept,
        completion_tokens: model.completionTokens,
        ms: Date.now() - startedMs,
      }),
    );
    return respond(200, { fields });
  } catch (err) {
    console.error(`${LOG} unhandled`, errorClass(err));
    return respond(500, { error: 'Internal error' });
  }
});
