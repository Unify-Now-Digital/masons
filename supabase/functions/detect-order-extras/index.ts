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

interface DetectedExtra {
  change_type: string;
  description: string;
  quote_snippet: string;
  quote_date: string | null;
  quote_sender?: string | null;
  confidence: 'high' | 'medium' | 'low';
  suggested_amount: number | null;
  reason_for_confidence: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

type SupabaseClient = ReturnType<typeof createClient>;

const EXTRAS_SYSTEM_PROMPT = `You are reviewing conversations between a memorial mason business (Churchill Memorials) and their customer.
Your task is to identify any changes or additions to the order that were agreed AFTER the deposit was paid.

IMPORTANT DISTINCTIONS:
- A customer ENQUIRING ("do you do vases?") is NOT a confirmed change
- A confirmed change requires the customer explicitly agreeing to an addition/change AND a price being discussed
- "Needs review" means a change was discussed but no price was confirmed
- "Low confidence" means there was a mention of a possible change with no follow-up agreement

Changes to look for:
- Photo plaque additions
- Inscription character count increases
- Lettering colour changes
- Vase additions
- Any other upgrades or modifications with an associated cost

For each flagged item, return a JSON array of objects with this exact schema:
{
  "change_type": "photo_plaque|inscription_increase|colour_change|vase|other",
  "description": "Brief description of the change",
  "quote_snippet": "Verbatim excerpt showing the agreement",
  "quote_date": "ISO date if available, null otherwise",
  "quote_sender": "Name of the person who confirmed, or null",
  "confidence": "high|medium|low",
  "suggested_amount": number or null,
  "reason_for_confidence": "Brief explanation of why this confidence level"
}

Return an empty array [] if no confirmed changes are found.
Return ONLY the JSON array, no other text.`;

async function callLLM(messages: Array<{ role: string; content: string }>): Promise<string | null> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: messages.find((m) => m.role === 'system')?.content ?? '',
        messages: messages.filter((m) => m.role !== 'system'),
      }),
    });

    if (!res.ok) {
      console.error('Anthropic API error:', await res.text());
      return null;
    }

    const data = await res.json() as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? null;
  }

  if (openaiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      console.error('OpenAI API error:', await res.text());
      return null;
    }

    const data = (await res.json()) as OpenAIChatResponse;
    return data.choices?.[0]?.message?.content ?? null;
  }

  console.error('No LLM API key configured (ANTHROPIC_API_KEY or OPENAI_API_KEY)');
  return null;
}

async function scanOrderConversations(
  supabase: SupabaseClient,
  orderId: string
): Promise<DetectedExtra[]> {
  // Get order details
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, person_id, deposit_date, sku, material, color, value, notes')
    .eq('id', orderId)
    .single();

  if (!order) return [];

  const depositDate = order.deposit_date;
  if (!depositDate) return []; // No deposit date = nothing to scan against

  // Collect messages from all sources
  const allMessages: Array<{ sender: string; date: string; text: string; source: string }> = [];

  // 1. Gmail/WhatsApp messages via inbox_conversations linked to the customer
  if (order.person_id) {
    const { data: conversations } = await supabase
      .from('inbox_conversations')
      .select('id, channel')
      .eq('person_id', order.person_id);

    if (conversations?.length) {
      const convIds = conversations.map((c) => c.id);
      const { data: messages } = await supabase
        .from('inbox_messages')
        .select('from_handle, body_text, sent_at, channel')
        .in('conversation_id', convIds)
        .gte('sent_at', depositDate)
        .order('sent_at', { ascending: true });

      if (messages?.length) {
        for (const msg of messages) {
          if (msg.body_text?.trim()) {
            allMessages.push({
              sender: msg.from_handle ?? 'Unknown',
              date: msg.sent_at,
              text: msg.body_text.substring(0, 2000), // Truncate long messages
              source: msg.channel ?? 'email',
            });
          }
        }
      }
    }
  }

  // 2. Phone notes from order_comments (if table exists)
  try {
    const { data: phoneNotes } = await supabase
      .from('order_comments')
      .select('id, body, created_at, author_name')
      .eq('order_id', orderId)
      .eq('comment_type', 'phone_note')
      .gte('created_at', depositDate)
      .order('created_at', { ascending: true });

    if (phoneNotes?.length) {
      for (const note of phoneNotes) {
        if (note.body?.trim()) {
          allMessages.push({
            sender: note.author_name ?? 'Staff',
            date: note.created_at,
            text: note.body.substring(0, 2000),
            source: 'phone_note',
          });
        }
      }
    }
  } catch {
    // order_comments table may not exist yet — skip silently
  }

  if (allMessages.length === 0) return [];

  // Format messages for LLM
  const messagesText = allMessages
    .map((m) => `[${m.source}] ${m.sender} (${new Date(m.date).toLocaleDateString('en-GB')}): ${m.text}`)
    .join('\n\n');

  const orderDescription = [
    order.sku && `SKU: ${order.sku}`,
    order.material && `Material: ${order.material}`,
    order.color && `Colour: ${order.color}`,
    order.value && `Value: £${order.value}`,
  ]
    .filter(Boolean)
    .join(', ');

  const userPrompt = `The deposit invoice was issued on ${new Date(depositDate).toLocaleDateString('en-GB')}.
The base order for ${order.customer_name} includes: ${orderDescription || 'standard memorial'}.

Review the following messages and identify any changes or additions agreed AFTER the deposit was issued.

Messages:
${messagesText}`;

  const llmResponse = await callLLM([
    { role: 'system', content: EXTRAS_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);

  if (!llmResponse) return [];

  // Parse JSON response
  try {
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as DetectedExtra[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) => item.change_type && item.description && item.confidence
    );
  } catch (e) {
    console.error('Failed to parse LLM response:', e, llmResponse);
    return [];
  }
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

    let body: { order_id?: string } = {};
    try {
      body = (await req.json()) as { order_id?: string };
    } catch {
      // Empty body = scan all orders
    }

    let orderIds: string[] = [];

    if (body.order_id) {
      orderIds = [body.order_id];
    } else {
      // Find orders with deposit paid and recent conversation activity
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .not('deposit_date', 'is', null)
        .not('person_id', 'is', null)
        .limit(50);

      orderIds = (orders ?? []).map((o) => o.id);
    }

    let totalDetected = 0;

    for (const orderId of orderIds) {
      const extras = await scanOrderConversations(supabase, orderId);

      for (const extra of extras) {
        // Dedup: check if already exists
        const { data: existing } = await supabase
          .from('order_extras')
          .select('id')
          .eq('order_id', orderId)
          .eq('change_type', extra.change_type)
          .maybeSingle();

        if (existing) continue;

        const { error: insertErr } = await supabase.from('order_extras').insert({
          order_id: orderId,
          source: 'gmail', // Default; ideally detect from conversation channel
          source_ref: null,
          change_type: extra.change_type,
          description: extra.description,
          quote_snippet: extra.quote_snippet,
          quote_date: extra.quote_date,
          quote_sender: extra.quote_sender ?? null,
          confidence: extra.confidence,
          confidence_reason: extra.reason_for_confidence,
          suggested_amount: extra.suggested_amount,
          status: 'pending',
        });

        if (insertErr) {
          if (insertErr.code === '23505') continue; // Unique constraint = already detected
          console.error('Failed to insert order extra:', insertErr);
          continue;
        }

        totalDetected++;
      }
    }

    return jsonResponse({ detected: totalDetected, orders_scanned: orderIds.length });
  } catch (err) {
    console.error('detect-order-extras error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
