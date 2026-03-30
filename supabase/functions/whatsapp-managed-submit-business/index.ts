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

function logSubmitBusinessError(
  error: { code?: string; message?: string; details?: string; hint?: string } | null | undefined,
  payload: SubmitBody,
) {
  console.error('Submit business failed', {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    payload,
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
  } catch (error) {
    logSubmitBusinessError(
      {
        message: error instanceof Error ? error.message : 'Invalid JSON body',
      },
      { connection_id: '', business_name: '', business_email: '', business_phone: '' },
    );
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  console.log('Submit business payload:', body);

  if (!body.connection_id || !body.business_name?.trim() || !body.business_email?.trim() || !body.business_phone?.trim()) {
    return jsonResponse({ error: 'connection_id, business_name, business_email and business_phone are required' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();

  console.log('Submit business: looking up managed connection', {
    connection_id: body.connection_id,
    user_id: user.id,
  });
  const { data: managed, error: readErr } = await supabase
    .from('whatsapp_managed_connections')
    .select('id, state')
    .eq('id', body.connection_id)
    .eq('user_id', user.id)
    .single();
  if (readErr || !managed) {
    logSubmitBusinessError(readErr, body);
    return jsonResponse({ error: 'Managed connection not found' }, 404);
  }
  console.log('Submit business: managed connection lookup result', {
    managed_connection_id: managed.id,
    state: managed.state,
  });

  // Idempotent-safe states:
  // - connected: already complete, return success without modifying state
  // - provisioning/pending provider-review states: already submitted/in-flight, return success
  if (
    ['connected', 'provisioning', 'pending_provider_review'].includes(
      managed.state,
    )
  ) {
    return jsonResponse({
      connection_id: managed.id,
      status: managed.state,
      next_check_after_seconds: managed.state === 'connected' ? 0 : 10,
      already_in_progress: managed.state !== 'connected',
    });
  }

  if (!['collecting_business_info', 'pending_meta_action', 'action_required'].includes(managed.state)) {
    return jsonResponse({ error: 'invalid_status_transition', status: managed.state }, 409);
  }

  // MVP realistic behavior: we do not fake instant connection.
  // We transition to provider-review pending and wait for provider sync/webhook updates.
  console.log('Submit business: updating managed connection state', {
    managed_connection_id: managed.id,
    next_state: 'pending_provider_review',
  });
  const { data: updated, error: updateErr } = await supabase
    .from('whatsapp_managed_connections')
    .update({
      state: 'pending_provider_review',
      last_error: null,
      label: body.business_name.trim(),
      meta: {
        business_name: body.business_name.trim(),
        business_email: body.business_email.trim(),
        business_phone: body.business_phone.trim(),
        meta_business_id: body.meta_business_id?.trim() || null,
      },
      last_state_change_at: now,
      provider_ready: false,
      updated_at: now,
    })
    .eq('id', managed.id)
    .select('id, state')
    .single();
  if (updateErr || !updated) {
    logSubmitBusinessError(updateErr, body);
    return jsonResponse({ error: 'Failed to submit onboarding details' }, 500);
  }
  console.log('Submit business: update result', {
    managed_connection_id: updated.id,
    state: updated.state,
  });

  await logManagedConnectionEvent(supabase, {
    managedConnectionId: managed.id,
    userId: user.id,
    actorType: 'user',
    eventType: 'managed_business_submitted',
    previousStatus: managed.state,
    newStatus: updated.state,
    payload: {
      business_name: body.business_name.trim(),
      business_email: body.business_email.trim(),
      business_phone: body.business_phone.trim(),
      meta_business_id: body.meta_business_id?.trim() || null,
    },
  });
  console.log('Submit business: managed connection event logged', {
    managed_connection_id: managed.id,
    previous_state: managed.state,
    new_state: updated.state,
  });

  return jsonResponse({
    connection_id: updated.id,
    status: updated.state,
    next_check_after_seconds: 10,
  });
});
