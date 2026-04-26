import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';
import { encryptSecret } from './whatsappCrypto.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

interface ConnectBody {
  twilio_account_sid: string;
  twilio_api_key_sid: string;
  twilio_api_key_secret: string;
  whatsapp_from: string;
}

function normalizeWhatsAppFrom(v: string): string {
  const s = (v ?? '').trim().replace(/^whatsapp:/, '');
  if (!s) return '';
  // Always store with whatsapp: prefix so downstream Twilio logic has a consistent format.
  return s.startsWith('whatsapp:') ? s : `whatsapp:${s}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
    .single();

  if (membershipError || !membership) {
    return new Response(
      JSON.stringify({ error: 'Admin access required to connect WhatsApp' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: ConnectBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sid = (body.twilio_account_sid ?? '').trim();
  const keySid = (body.twilio_api_key_sid ?? '').trim();
  const secret = (body.twilio_api_key_secret ?? '').trim();
  const fromRaw = (body.whatsapp_from ?? '').trim();
  const whatsappFrom = normalizeWhatsAppFrom(fromRaw);

  if (!sid || !keySid || !secret || !whatsappFrom) {
    return new Response(
      JSON.stringify({
        error: 'twilio_account_sid, twilio_api_key_sid, twilio_api_key_secret, and whatsapp_from are required',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Local format validation only; live Twilio validation is handled explicitly via whatsapp-test.
  const accountSidPattern = /^AC[a-zA-Z0-9]{32}$/;
  const apiKeySidPattern = /^SK[a-zA-Z0-9]{32}$/;
  const whatsappFromPattern = /^whatsapp:\+[1-9]\d{6,14}$/; // E.164 inside whatsapp: prefix

  if (!accountSidPattern.test(sid)) {
    return new Response(
      JSON.stringify({ error: 'Invalid Twilio Account SID format' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!apiKeySidPattern.test(keySid)) {
    return new Response(
      JSON.stringify({ error: 'Invalid Twilio API Key SID format' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!secret) {
    return new Response(
      JSON.stringify({ error: 'API Key Secret must be non-empty' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!whatsappFromPattern.test(whatsappFrom)) {
    return new Response(
      JSON.stringify({ error: 'Invalid whatsapp_from format. Expected whatsapp:+<E.164 number>' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let encryptedSecret: string;
  try {
    encryptedSecret = await encryptSecret(secret);
  } catch (e) {
    console.error('whatsapp-connect: encryption failed', e);
    return new Response(
      JSON.stringify({ error: 'Server encryption error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'connected')
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from('whatsapp_connections')
      .update({
        status: 'disconnected',
        disconnected_at: now,
        updated_at: now,
      })
      .eq('id', existing.id);
  }

  const { data: row, error: insertErr } = await supabaseAdmin
    .from('whatsapp_connections')
    .insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      provider: 'twilio',
      twilio_account_sid: sid,
      twilio_api_key_sid: keySid,
      twilio_api_key_secret_encrypted: encryptedSecret,
      whatsapp_from: whatsappFrom,
      status: 'connected',
      last_error: null,
      last_validated_at: now,
      disconnected_at: null,
      updated_at: now,
    })
    .select('id, status')
    .single();

  if (insertErr || !row) {
    console.error('whatsapp-connect: insert failed', insertErr);
    return new Response(
      JSON.stringify({ error: 'Failed to save connection' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, id: row.id, status: row.status }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
