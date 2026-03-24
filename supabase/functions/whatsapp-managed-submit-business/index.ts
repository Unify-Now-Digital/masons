import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';
import { logManagedConnectionEvent } from './whatsappConnectionEvents.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

interface SubmitBody {
  connection_id: string;
  business_name: string;
  business_email: string;
  business_phone: string;
  meta_business_id?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const user = await getUserFromRequest(req);
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.connection_id || !body.business_name?.trim() || !body.business_email?.trim() || !body.business_phone?.trim()) {
    return jsonResponse({ error: 'connection_id, business_name, business_email and business_phone are required' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();

  const { data: managed, error: readErr } = await supabase
    .from('whatsapp_managed_connections')
    .select('id, status')
    .eq('id', body.connection_id)
    .eq('user_id', user.id)
    .single();
  if (readErr || !managed) return jsonResponse({ error: 'Managed connection not found' }, 404);
  if (!['collecting_business_info', 'pending_meta_action', 'action_required'].includes(managed.status)) {
    return jsonResponse({ error: 'invalid_status_transition', status: managed.status }, 409);
  }

  // MVP realistic behavior: we do not fake instant connection.
  // We transition to provider-review pending and wait for provider sync/webhook updates.
  const { data: updated, error: updateErr } = await supabase
    .from('whatsapp_managed_connections')
    .update({
      status: 'pending_provider_review',
      status_reason_code: 'provider_review_pending',
      status_reason_message: 'Provider onboarding submitted. Waiting for Twilio/Meta readiness.',
      meta_business_id: body.meta_business_id?.trim() || null,
      display_phone_number: body.business_phone.trim(),
      provider_ready: false,
      updated_at: now,
    })
    .eq('id', managed.id)
    .select('id, status')
    .single();
  if (updateErr || !updated) return jsonResponse({ error: 'Failed to submit onboarding details' }, 500);

  await logManagedConnectionEvent(supabase, {
    managedConnectionId: managed.id,
    userId: user.id,
    actorType: 'user',
    eventType: 'managed_business_submitted',
    previousStatus: managed.status,
    newStatus: updated.status,
    payload: {
      business_name: body.business_name.trim(),
      business_email: body.business_email.trim(),
      business_phone: body.business_phone.trim(),
      meta_business_id: body.meta_business_id?.trim() || null,
    },
  });

  return jsonResponse({
    connection_id: updated.id,
    status: updated.status,
    next_check_after_seconds: 10,
  });
});
