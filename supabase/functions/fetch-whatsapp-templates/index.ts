import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

type ContentTemplate = {
  sid: string;
  friendly_name?: string;
  variables?: Record<string, string>;
  types?: Record<string, unknown>;
  language?: string;
  approval_requests?: Record<string, { status?: string }>;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractBodyFromTypes(types: Record<string, unknown> | undefined): string {
  if (!types) return '';
  const candidates = ['twilio/text', 'twilio/card', 'twilio/quick-reply', 'twilio/call-to-action', 'twilio/media'];
  for (const key of candidates) {
    const node = types[key] as { body?: string } | undefined;
    if (node?.body && typeof node.body === 'string') return node.body;
  }
  return '';
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const accountSid =
    Deno.env.get('TWILIO_ACCOUNT_SID') ??
    Deno.env.get('TWILIO_MANAGED_ACCOUNT_SID');
  const authToken =
    Deno.env.get('TWILIO_AUTH_TOKEN') ??
    Deno.env.get('TWILIO_MANAGED_AUTH_TOKEN');

  if (!accountSid || !authToken) {
    return jsonResponse({ error: 'Twilio Content API credentials not configured' }, 500);
  }

  const resp = await fetch('https://content.twilio.com/v1/Content', {
    method: 'GET',
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
    },
  });

  if (!resp.ok) {
    const err = await resp.text();
    return jsonResponse({ error: `Failed to fetch templates: ${err}` }, 502);
  }

  const data = await resp.json() as { contents?: ContentTemplate[] };
  const rawTemplates = data.contents ?? [];
  console.log('Twilio templates raw count:', rawTemplates.length);
  console.log('Twilio first template raw object:', rawTemplates[0] ?? null);
  console.log('Twilio first template approval_requests:', rawTemplates[0]?.approval_requests ?? null);

  const templates = rawTemplates
    .map((item) => {
      const body = extractBodyFromTypes(item.types);
      const vars = Array.from(new Set(Array.from(body.matchAll(/\{\{(\d+)\}\}/g)).map((m) => m[1]))).sort(
        (a, b) => Number(a) - Number(b),
      );
      return {
        sid: item.sid,
        friendlyName: item.friendly_name ?? item.sid,
        status: 'approved',
        body,
        variables: vars,
      };
    });
  console.log('Twilio templates returned count:', templates.length);

  return jsonResponse({ templates });
});
