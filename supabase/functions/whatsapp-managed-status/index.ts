import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';
import { isManagedConnected } from './whatsappManagedStatus.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-admin-token, x-user-id',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function resolveUserId(req: Request): Promise<string | null> {
  const jwtUser = await getUserFromRequest(req);
  if (jwtUser) return jwtUser.id;

  const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
  const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');
  if (!expectedToken || !adminToken || adminToken !== expectedToken) {
    return null;
  }

  const headerUserId = req.headers.get('x-user-id') ?? req.headers.get('X-User-Id');
  if (headerUserId?.trim()) return headerUserId.trim();

  const url = new URL(req.url);
  return url.searchParams.get('user_id')?.trim() || null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const userId = await resolveUserId(req);
  if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: managed, error } = await supabase
    .from('whatsapp_managed_connections')
    .select(
      'id, state, last_error, provider_ready, platform_twilio_account_sid, twilio_sender, display_number, updated_at',
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return jsonResponse({ error: 'Failed to fetch managed connection status' }, 500);
  if (!managed) return jsonResponse({ exists: false, mode: 'managed', status: 'draft' });

  const readiness = isManagedConnected({
    status: managed.state,
    provider_ready: managed.provider_ready,
    twilio_account_sid: managed.platform_twilio_account_sid,
    twilio_whatsapp_sender_sid: managed.twilio_sender,
    whatsapp_from_address: managed.display_number,
    last_error: managed.last_error,
  });
  return jsonResponse({
    exists: true,
    mode: 'managed',
    connection_id: managed.id,
    status: managed.state,
    status_reason_code: readiness.reasonCode,
    status_reason_message: readiness.reasonMessage,
    action_required: managed.state === 'action_required' || managed.state === 'pending_meta_action' || managed.state === 'failed',
    connected_requirements: {
      has_account_sid: Boolean(managed.platform_twilio_account_sid),
      has_sender_sid: Boolean(managed.twilio_sender),
      has_from_address: Boolean(managed.display_number),
      provider_ready: Boolean(managed.provider_ready),
    },
    last_synced_at: managed.updated_at,
  });
});
