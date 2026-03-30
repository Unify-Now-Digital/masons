import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';
import { logManagedConnectionEvent } from './whatsappConnectionEvents.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-admin-token, x-user-id',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function logDbError(context: string, error: { code?: string; message?: string; details?: string; hint?: string } | null | undefined, extra: Record<string, unknown> = {}): void {
  if (!error) return;
  console.error(`whatsapp-managed-start: ${context}`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    ...extra,
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

  const body = await req.clone().json().catch(() => ({})) as { user_id?: string };
  return body.user_id?.trim() || null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const userId = await resolveUserId(req);
  if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error' }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();

  const { data: authUser, error: authUserErr } = await supabase
    .schema('auth')
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (authUserErr) {
    // auth.users is not in public schema; keep as diagnostic-only and continue.
    logDbError('auth user diagnostic read failed', authUserErr, { userId });
  } else if (!authUser) {
    console.error('whatsapp-managed-start: user id from auth token not found in auth.users (possible FK failure on insert)', { userId });
  }

  const { data: existing, error: existingErr } = await supabase
    .from('whatsapp_managed_connections')
    .select('id, state')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) {
    logDbError('failed reading existing managed connection', existingErr, { userId });
    return jsonResponse({ error: 'Failed to load managed connection' }, 500);
  }

  if (existing && existing.state === 'connected') {
    return jsonResponse({ error: 'onboarding_already_connected' }, 409);
  }

  if (existing) {
    if (existing.state === 'disconnected' || existing.state === 'failed') {
      const { data: updated, error: updateErr } = await supabase
        .from('whatsapp_managed_connections')
        .update({
          state: 'collecting_business_info',
          last_error: null,
          last_state_change_at: now,
          disconnected_at: null,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select('id, state')
        .single();
      if (updateErr || !updated) {
        logDbError('update failed', updateErr, { userId, connectionId: existing.id });
        return jsonResponse({ error: 'Failed to start onboarding' }, 500);
      }
      await logManagedConnectionEvent(supabase, {
        managedConnectionId: updated.id,
        userId,
        actorType: 'user',
        eventType: 'managed_onboarding_started',
        previousStatus: existing.state,
        newStatus: updated.state,
      });
      return jsonResponse({ connection_id: updated.id, status: updated.state });
    }

    return jsonResponse({ connection_id: existing.id, status: existing.state });
  }

  const insertPayload = {
    user_id: userId,
    state: 'collecting_business_info',
    last_state_change_at: now,
    updated_at: now,
  };
  console.log('Insert payload:', insertPayload);

  const { data: inserted, error } = await supabase
    .from('whatsapp_managed_connections')
    .insert(insertPayload)
    .select('id, state')
    .single();
  if (error || !inserted) {
    console.error('Managed insert failed', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      payload: insertPayload,
    });

    if (error) {
      // Safe fallback for duplicate active connection races / prior rows:
      // return the latest row instead of hard-failing when unique index blocks insert.
      if (error.code === '23505') {
        const { data: fallback, error: fallbackErr } = await supabase
          .from('whatsapp_managed_connections')
          .select('id, state')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        logDbError('fallback select failed after unique violation', fallbackErr, { userId });
        if (!fallbackErr && fallback) {
          return jsonResponse({ connection_id: fallback.id, status: fallback.state });
        }
      }

      if (error.code === '23503') {
        return jsonResponse({ error: 'Failed to create managed connection (user foreign key mismatch)' }, 500);
      }
    }
    return jsonResponse({ error: 'Failed to create managed connection' }, 500);
  }

  await logManagedConnectionEvent(supabase, {
    managedConnectionId: inserted.id,
    userId,
    actorType: 'user',
    eventType: 'managed_onboarding_started',
    newStatus: inserted.state,
  });

  return jsonResponse({ connection_id: inserted.id, status: inserted.state });
});
