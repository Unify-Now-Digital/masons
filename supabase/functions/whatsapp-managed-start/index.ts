import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';
import { logManagedConnectionEvent } from './whatsappConnectionEvents.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error' }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('whatsapp_managed_connections')
    .select('id, status')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.status === 'connected') {
    return jsonResponse({ error: 'onboarding_already_connected' }, 409);
  }

  if (existing) {
    if (existing.status === 'disconnected' || existing.status === 'failed') {
      const { data: updated, error: updateErr } = await supabase
        .from('whatsapp_managed_connections')
        .update({
          status: 'collecting_business_info',
          status_reason_code: null,
          status_reason_message: null,
          onboarding_started_at: now,
          disconnected_at: null,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select('id, status')
        .single();
      if (updateErr || !updated) return jsonResponse({ error: 'Failed to start onboarding' }, 500);
      await logManagedConnectionEvent(supabase, {
        managedConnectionId: updated.id,
        userId: user.id,
        actorType: 'user',
        eventType: 'managed_onboarding_started',
        previousStatus: existing.status,
        newStatus: updated.status,
      });
      return jsonResponse({ connection_id: updated.id, status: updated.status });
    }

    return jsonResponse({ connection_id: existing.id, status: existing.status });
  }

  const { data: inserted, error } = await supabase
    .from('whatsapp_managed_connections')
    .insert({
      user_id: user.id,
      status: 'collecting_business_info',
      onboarding_started_at: now,
      updated_at: now,
    })
    .select('id, status')
    .single();
  if (error || !inserted) return jsonResponse({ error: 'Failed to create managed connection' }, 500);

  await logManagedConnectionEvent(supabase, {
    managedConnectionId: inserted.id,
    userId: user.id,
    actorType: 'user',
    eventType: 'managed_onboarding_started',
    newStatus: inserted.status,
  });

  return jsonResponse({ connection_id: inserted.id, status: inserted.status });
});
