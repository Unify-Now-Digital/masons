import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-internal-key',
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Max messages included in the model prompt (newest retained when over limit). */
const MAX_MESSAGES_IN_PROMPT = 60;

function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RequestBody {
  scope?: string;
  conversation_id?: string;
  person_id?: string;
  channel?: string;
  handle?: string;
}

interface MsgRow {
  id: string;
  conversation_id: string;
  sent_at: string | null;
  created_at: string;
  channel: string;
  direction: string;
  body_text: string | null;
  from_handle: string;
  to_handle: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Same ordering as usePersonUnifiedTimeline in useInboxMessages.ts */
function sortMessagesLikeUnifiedTimeline(rows: MsgRow[]): MsgRow[] {
  const byId = new Map<string, MsgRow>();
  for (const m of rows) {
    byId.set(m.id, m);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const aSent = new Date(a.sent_at ?? a.created_at).getTime();
    const bSent = new Date(b.sent_at ?? b.created_at).getTime();
    if (aSent !== bSent) return aSent - bSent;
    const aCreated = new Date(a.created_at).getTime();
    const bCreated = new Date(b.created_at).getTime();
    if (aCreated !== bCreated) return aCreated - bCreated;
    return a.id.localeCompare(b.id);
  });
}

function fingerprintForMessages(sorted: MsgRow[]): string {
  const parts = sorted.map((m) => `${m.id}:${m.created_at}`);
  return parts.join('|');
}

/** Log PostgREST / Supabase errors with full detail for Edge Function logs. */
function logDbError(context: string, err: unknown): void {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    console.error(
      `inbox-ai-thread-summary ${context}`,
      JSON.stringify({
        message: o.message,
        code: o.code,
        details: o.details,
        hint: o.hint,
      })
    );
  } else {
    console.error(`inbox-ai-thread-summary ${context}`, String(err));
  }
  logMissingColumnHint(err);
}

/** When PostgREST reports a missing column, add a second log line for faster fixes. */
function logMissingColumnHint(err: unknown): void {
  const msg =
    err && typeof err === 'object' && typeof (err as { message?: string }).message === 'string'
      ? (err as { message: string }).message
      : '';
  if (/does not exist/i.test(msg) && /column/i.test(msg)) {
    console.error(
      'inbox-ai-thread-summary: missing column — apply migration 20260323140000_inbox_ai_summaries_unlinked_timeline.sql (user_id, unlinked_*, scope_shape) or align payload with DB.'
    );
  }
}

type ExistingSummaryRow = { id: string; summary_text: string; messages_fingerprint: string };

/** Fields PostgREST returns for Postgres errors (safe to echo to client for debugging). */
function postgrestErrorFields(err: unknown): {
  code: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
} {
  if (!err || typeof err !== 'object') {
    return { code: null, message: err == null ? null : String(err), details: null, hint: null };
  }
  const o = err as Record<string, unknown>;
  const str = (v: unknown): string | null =>
    typeof v === 'string' ? v : v != null ? String(v) : null;
  return {
    code: str(o.code),
    message: str(o.message),
    details: str(o.details),
    hint: str(o.hint),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return postgrestErrorFields(err).code === '23505';
}

/**
 * Load at most one cached summary row. Always uses limit(1) so duplicate rows (data drift)
 * do not make maybeSingle() fail with PGRST116 and force a failing insert.
 */
async function fetchExistingSummaryRow(
  supabase: SupabaseClient,
  scope: string,
  body: RequestBody,
  authUserId: string | null
): Promise<{ row: ExistingSummaryRow | null; selectError: unknown | null }> {
  if (scope === 'conversation') {
    const cid = body.conversation_id!.trim();
    const { data, error } = await supabase
      .from('inbox_ai_thread_summaries')
      .select('id, summary_text, messages_fingerprint')
      .eq('scope', 'conversation')
      .eq('conversation_id', cid)
      .limit(1)
      .maybeSingle();
    return { row: (data as ExistingSummaryRow | null) ?? null, selectError: error };
  }
  if (scope === 'customer_timeline') {
    const pid = body.person_id!.trim();
    const { data, error } = await supabase
      .from('inbox_ai_thread_summaries')
      .select('id, summary_text, messages_fingerprint')
      .eq('scope', 'customer_timeline')
      .eq('person_id', pid)
      .limit(1)
      .maybeSingle();
    return { row: (data as ExistingSummaryRow | null) ?? null, selectError: error };
  }
  const ch = typeof body.channel === 'string' ? body.channel.trim() : '';
  const h = typeof body.handle === 'string' ? body.handle.trim() : '';
  const { data, error } = await supabase
    .from('inbox_ai_thread_summaries')
    .select('id, summary_text, messages_fingerprint')
    .eq('scope', 'unlinked_timeline')
    .eq('user_id', authUserId!)
    .eq('unlinked_channel', ch)
    .eq('unlinked_handle', h)
    .limit(1)
    .maybeSingle();
  return { row: (data as ExistingSummaryRow | null) ?? null, selectError: error };
}

function saveSummaryFailedResponse(
  jsonHeaders: Record<string, string>,
  operation: 'insert' | 'update',
  err: unknown
): Response {
  const pe = postgrestErrorFields(err);
  logDbError(`inbox_ai_thread_summaries ${operation}`, err);
  return new Response(
    JSON.stringify({
      error: 'Failed to save summary',
      db: pe,
    }),
    { status: 500, headers: jsonHeaders }
  );
}

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

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

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

    // Same auth model as inbox-ai-suggest-reply: valid user JWT OR internal key (no authUserId required).
    let authorized = false;
    let authUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, '').trim());
      if (!authError && user) {
        authorized = true;
        authUserId = user.id;
      }
    }
    if (!authorized && expectedInternalKey) {
      const providedKey = req.headers.get('x-internal-key') ?? '';
      if (providedKey === expectedInternalKey) authorized = true;
    }
    if (!authorized) {
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

    const scope = typeof body?.scope === 'string' ? body.scope.trim() : '';
    if (scope !== 'conversation' && scope !== 'customer_timeline' && scope !== 'unlinked_timeline') {
      return new Response(
        JSON.stringify({ error: 'scope must be conversation, customer_timeline, or unlinked_timeline' }),
        {
          status: 400,
          headers: jsonHeaders,
        },
      );
    }

    if (scope === 'unlinked_timeline' && !authUserId) {
      return new Response(JSON.stringify({ error: 'Unlinked timeline requires a signed-in user' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let messages: MsgRow[] = [];
    let organizationId: string | null = null;

    if (scope === 'conversation') {
      const conversationId =
        typeof body.conversation_id === 'string' ? body.conversation_id.trim() : '';
      if (!conversationId || !UUID_REGEX.test(conversationId)) {
        return new Response(JSON.stringify({ error: 'conversation_id is required and must be a valid UUID' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const { data: conv, error: convErr } = await supabase
        .from('inbox_conversations')
        .select('id, organization_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (convErr) {
        logDbError(`conversation lookup id=${conversationId}`, convErr);
        return new Response(JSON.stringify({ error: 'Failed to load conversation' }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
      if (!conv) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: jsonHeaders,
        });
      }
      organizationId =
        (conv as { organization_id?: string | null }).organization_id ?? null;

      // Single order only — chained .order() + nullsFirst on nullable sent_at can break PostgREST on some deployments.
      // Final order matches the app via sortMessagesLikeUnifiedTimeline below.
      const { data: rows, error: msgErr } = await supabase
        .from('inbox_messages')
        .select(
          'id, conversation_id, created_at, sent_at, channel, direction, body_text, from_handle, to_handle'
        )
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgErr) {
        logDbError(`messages conversation_id=${conversationId}`, msgErr);
        return new Response(JSON.stringify({ error: 'Failed to load messages' }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
      messages = (rows ?? []) as MsgRow[];
    } else if (scope === 'customer_timeline') {
      const personId = typeof body.person_id === 'string' ? body.person_id.trim() : '';
      if (!personId || !UUID_REGEX.test(personId)) {
        return new Response(JSON.stringify({ error: 'person_id is required and must be a valid UUID' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const { data: convRows, error: convListErr } = await supabase
        .from('inbox_conversations')
        .select('id, organization_id')
        .eq('person_id', personId)
        .eq('status', 'open');

      if (convListErr) {
        logDbError(`conversations person_id=${personId}`, convListErr);
        return new Response(JSON.stringify({ error: 'Failed to load conversations' }), {
          status: 500,
          headers: jsonHeaders,
        });
      }

      const conversationIds = (convRows ?? [])
        .map((r: { id: string }) => r.id)
        .filter((id): id is string => typeof id === 'string' && UUID_REGEX.test(id));
      organizationId =
        ((convRows?.[0] as { organization_id?: string | null } | undefined)?.organization_id) ?? null;

      // Never call .in() with an empty list (PostgREST error on some versions).
      if (conversationIds.length === 0) {
        return new Response(JSON.stringify({ summary: null }), { status: 200, headers: jsonHeaders });
      }

      const { data: rows, error: msgErr } = await supabase
        .from('inbox_messages')
        .select(
          'id, conversation_id, created_at, sent_at, channel, direction, body_text, from_handle, to_handle'
        )
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true });

      if (msgErr) {
        logDbError(
          `customer messages person_id=${personId} conversation_ids=${conversationIds.length}`,
          msgErr
        );
        return new Response(JSON.stringify({ error: 'Failed to load messages' }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
      messages = sortMessagesLikeUnifiedTimeline((rows ?? []) as MsgRow[]);
    } else {
      const ch = typeof body.channel === 'string' ? body.channel.trim() : '';
      const h = typeof body.handle === 'string' ? body.handle.trim() : '';
      if (!['email', 'sms', 'whatsapp'].includes(ch)) {
        return new Response(JSON.stringify({ error: 'channel must be email, sms, or whatsapp' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
      if (!h) {
        return new Response(JSON.stringify({ error: 'handle is required' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const { data: convRows, error: convListErr } = await supabase
        .from('inbox_conversations')
        .select('id, organization_id')
        .eq('user_id', authUserId!)
        .eq('status', 'open')
        .is('person_id', null)
        .eq('channel', ch)
        .eq('primary_handle', h);

      if (convListErr) {
        logDbError(`unlinked conversations user=${authUserId} channel=${ch}`, convListErr);
        return new Response(JSON.stringify({ error: 'Failed to load conversations' }), {
          status: 500,
          headers: jsonHeaders,
        });
      }

      const conversationIds = (convRows ?? [])
        .map((r: { id: string }) => r.id)
        .filter((id): id is string => typeof id === 'string' && UUID_REGEX.test(id));
      organizationId =
        ((convRows?.[0] as { organization_id?: string | null } | undefined)?.organization_id) ?? null;

      if (conversationIds.length === 0) {
        await supabase
          .from('inbox_ai_thread_summaries')
          .delete()
          .eq('scope', 'unlinked_timeline')
          .eq('user_id', authUserId!)
          .eq('unlinked_channel', ch)
          .eq('unlinked_handle', h);
        return new Response(JSON.stringify({ summary: null }), { status: 200, headers: jsonHeaders });
      }

      const { data: rows, error: msgErr } = await supabase
        .from('inbox_messages')
        .select(
          'id, conversation_id, created_at, sent_at, channel, direction, body_text, from_handle, to_handle'
        )
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true });

      if (msgErr) {
        logDbError(`unlinked messages channel=${ch} ids=${conversationIds.length}`, msgErr);
        return new Response(JSON.stringify({ error: 'Failed to load messages' }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
      messages = sortMessagesLikeUnifiedTimeline((rows ?? []) as MsgRow[]);
    }

    if (scope === 'conversation') {
      messages = sortMessagesLikeUnifiedTimeline(messages);
    }

    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'Could not resolve organization' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const fpInput = fingerprintForMessages(messages);
    const messagesFingerprint = await sha256Hex(fpInput);

    if (messages.length === 0) {
      if (scope === 'conversation') {
        const cid = typeof body.conversation_id === 'string' ? body.conversation_id.trim() : '';
        await supabase
          .from('inbox_ai_thread_summaries')
          .delete()
          .eq('scope', 'conversation')
          .eq('conversation_id', cid);
      } else if (scope === 'customer_timeline') {
        const pid = typeof body.person_id === 'string' ? body.person_id.trim() : '';
        await supabase
          .from('inbox_ai_thread_summaries')
          .delete()
          .eq('scope', 'customer_timeline')
          .eq('person_id', pid);
      } else {
        const ch = typeof body.channel === 'string' ? body.channel.trim() : '';
        const h = typeof body.handle === 'string' ? body.handle.trim() : '';
        await supabase
          .from('inbox_ai_thread_summaries')
          .delete()
          .eq('scope', 'unlinked_timeline')
          .eq('user_id', authUserId!)
          .eq('unlinked_channel', ch)
          .eq('unlinked_handle', h);
      }
      return new Response(JSON.stringify({ summary: null }), { status: 200, headers: jsonHeaders });
    }

    const { row: existing, selectError: existingSelectError } = await fetchExistingSummaryRow(
      supabase,
      scope,
      body,
      authUserId
    );
    if (existingSelectError) {
      logDbError('inbox_ai_thread_summaries select existing', existingSelectError);
    }

    if (existing?.messages_fingerprint === messagesFingerprint) {
      return new Response(JSON.stringify({ summary: existing.summary_text }), {
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

    const forPrompt =
      messages.length > MAX_MESSAGES_IN_PROMPT
        ? messages.slice(-MAX_MESSAGES_IN_PROMPT)
        : messages;

    const transcriptLines = forPrompt.map((m) => {
      const raw = m.body_text ?? '';
      const text = m.channel === 'email' ? stripHtml(raw) || '(No message body)' : raw.trim() || '(No message body)';
      const ts = m.sent_at ?? m.created_at;
      return `[${m.channel}] [${m.direction}] ${ts} from=${m.from_handle} to=${m.to_handle}: ${text}`;
    });

    const systemContent =
      'You are a helpful assistant for a memorial masonry business. Summarise the conversation thread in one short paragraph for internal staff: calm, factual, professional. Do not invent details. Output only valid JSON with a single key "summary" whose value is the paragraph text. No other keys or commentary.';
    const userContent = `Summarise this message thread (oldest to newest within this excerpt):\n\n${transcriptLines.join('\n')}`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI error:', openaiRes.status, errText);
      return new Response(JSON.stringify({ error: 'Failed to generate summary' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const openaiData = (await openaiRes.json()) as OpenAIChatResponse;
    const rawContent = openaiData?.choices?.[0]?.message?.content;
    if (!rawContent) {
      return new Response(JSON.stringify({ error: 'Invalid AI response' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    let summary: string;
    try {
      const parsed = JSON.parse(rawContent) as { summary?: string };
      summary =
        typeof parsed?.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : rawContent.trim();
    } catch {
      summary = rawContent.trim();
    }

    if (!summary) {
      return new Response(JSON.stringify({ error: 'Empty summary' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const nowIso = new Date().toISOString();
    const rowPayload =
      scope === 'conversation'
        ? {
            scope: 'conversation' as const,
            conversation_id: body.conversation_id!.trim(),
            person_id: null,
            user_id: null,
            unlinked_channel: null,
            unlinked_handle: null,
            organization_id: organizationId,
            summary_text: summary,
            messages_fingerprint: messagesFingerprint,
            updated_at: nowIso,
          }
        : scope === 'customer_timeline'
          ? {
              scope: 'customer_timeline' as const,
              conversation_id: null,
              person_id: body.person_id!.trim(),
              user_id: null,
              unlinked_channel: null,
              unlinked_handle: null,
              organization_id: organizationId,
              summary_text: summary,
              messages_fingerprint: messagesFingerprint,
              updated_at: nowIso,
            }
          : {
              scope: 'unlinked_timeline' as const,
              conversation_id: null,
              person_id: null,
              user_id: authUserId!,
              unlinked_channel: typeof body.channel === 'string' ? body.channel.trim() : '',
              unlinked_handle: typeof body.handle === 'string' ? body.handle.trim() : '',
              organization_id: organizationId,
              summary_text: summary,
              messages_fingerprint: messagesFingerprint,
              updated_at: nowIso,
            };

    if (existing?.id) {
      const { error: upErr } = await supabase
        .from('inbox_ai_thread_summaries')
        .update({
          summary_text: summary,
          messages_fingerprint: messagesFingerprint,
          updated_at: nowIso,
        })
        .eq('id', existing.id);
      if (upErr) {
        return saveSummaryFailedResponse(jsonHeaders, 'update', upErr);
      }
    } else {
      const { error: insErr } = await supabase.from('inbox_ai_thread_summaries').insert(rowPayload);
      if (!insErr) {
        // inserted
      } else if (isUniqueViolation(insErr)) {
        logDbError('inbox_ai_thread_summaries insert unique_violation, retrying update', insErr);
        const { row: conflictRow } = await fetchExistingSummaryRow(supabase, scope, body, authUserId);
        if (conflictRow?.id) {
          const { error: upRetryErr } = await supabase
            .from('inbox_ai_thread_summaries')
            .update({
              summary_text: summary,
              messages_fingerprint: messagesFingerprint,
              updated_at: nowIso,
            })
            .eq('id', conflictRow.id);
          if (upRetryErr) {
            return saveSummaryFailedResponse(jsonHeaders, 'update', upRetryErr);
          }
        } else {
          return saveSummaryFailedResponse(jsonHeaders, 'insert', insErr);
        }
      } else {
        return saveSummaryFailedResponse(jsonHeaders, 'insert', insErr);
      }
    }

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (e) {
    console.error('inbox-ai-thread-summary:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
