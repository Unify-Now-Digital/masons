import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

interface LogEventInput {
  managedConnectionId: string;
  userId: string;
  actorType: 'system' | 'user' | 'provider_webhook' | 'support';
  eventType: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  payload?: Record<string, unknown>;
  requestId?: string | null;
  correlationId?: string | null;
}

export async function logManagedConnectionEvent(
  supabase: SupabaseClient,
  input: LogEventInput,
): Promise<void> {
  const { error } = await supabase.from('whatsapp_connection_events').insert({
    managed_connection_id: input.managedConnectionId,
    user_id: input.userId,
    actor_type: input.actorType,
    event_type: input.eventType,
    previous_status: input.previousStatus ?? null,
    new_status: input.newStatus ?? null,
    payload: input.payload ?? {},
    request_id: input.requestId ?? null,
    correlation_id: input.correlationId ?? null,
  });

  if (error) {
    console.error('logManagedConnectionEvent failed', {
      message: error.message,
      code: error.code,
      eventType: input.eventType,
    });
  }
}
