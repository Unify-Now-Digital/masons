import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-internal-key',
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  message_id?: string;
}

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
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

    let authorized = false;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, '').trim());
      if (!authError && user) authorized = true;
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
    // TODO: Once login is implemented, remove internal-key fallback and require JWT only.

    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON or missing body' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const messageId = typeof body?.message_id === 'string' ? body.message_id.trim() : '';
    if (!messageId || !UUID_REGEX.test(messageId)) {
      return new Response(JSON.stringify({ error: 'message_id is required and must be a valid UUID' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: message, error: msgError } = await supabase
      .from('inbox_messages')
      .select('id, direction, body_text, conversation_id, inbox_conversations!inner(organization_id)')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return new Response(JSON.stringify({ error: 'Message not found' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    if (message.direction !== 'inbound') {
      return new Response(JSON.stringify({ error: 'Suggestion only for inbound messages' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const organizationId =
      (message as { inbox_conversations?: { organization_id?: string | null } })
        .inbox_conversations?.organization_id ?? null;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve organization' }),
        { status: 500, headers: jsonHeaders }
      );
    }

    const { data: cached } = await supabase
      .from('inbox_ai_suggestions')
      .select('suggestion_text')
      .eq('message_id', messageId)
      .maybeSingle();

    if (cached?.suggestion_text) {
      return new Response(JSON.stringify({ suggestion: cached.suggestion_text }), {
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

    const bodyText = stripHtml(message.body_text ?? '') || '(No message body)';

    const systemContent =
      'You are a helpful assistant for a memorial masonry business. Reply in a brief, professional, empathetic tone. Output only valid JSON with a single key "suggestion" whose value is the suggested reply text (one or two sentences). No other keys or commentary.';
    const userContent = `Suggest a short professional reply to this customer message:\n\n${bodyText}`;

    const chatPayload = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system' as const, content: systemContent },
        { role: 'user' as const, content: userContent },
      ] as OpenAIChatMessage[],
      response_format: { type: 'json_object' as const },
    };

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify(chatPayload),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI error:', openaiRes.status, errText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate suggestion' }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const openaiData = (await openaiRes.json()) as OpenAIChatResponse;
    const rawContent = openaiData?.choices?.[0]?.message?.content;
    if (!rawContent) {
      return new Response(
        JSON.stringify({ error: 'Invalid AI response' }),
        { status: 500, headers: jsonHeaders },
      );
    }

    let suggestion: string;
    try {
      const parsed = JSON.parse(rawContent) as { suggestion?: string };
      suggestion =
        typeof parsed?.suggestion === 'string' && parsed.suggestion.trim()
          ? parsed.suggestion.trim()
          : rawContent.trim();
    } catch {
      suggestion = rawContent.trim();
    }

    if (!suggestion) {
      return new Response(
        JSON.stringify({ error: 'Empty suggestion' }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const { error: insertErr } = await supabase.from('inbox_ai_suggestions').insert({
      message_id: messageId,
      suggestion_text: suggestion,
      organization_id: organizationId,
    });

    if (insertErr) {
      console.error('Insert inbox_ai_suggestions:', insertErr);
      return new Response(
        JSON.stringify({ error: 'Failed to save suggestion' }),
        { status: 500, headers: jsonHeaders },
      );
    }

    return new Response(JSON.stringify({ suggestion }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (e) {
    console.error('inbox-ai-suggest-reply:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
