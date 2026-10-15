/**
 * Writes one activity_events row through log_activity_event.
 * A missing function (migration not applied yet) must not fail the caller:
 * Stripe and Revolut webhooks keep their own result.
 */

export interface ActivityEventInput {
  organizationId: string;
  type: string;
  category: string;
  priority: 'action' | 'fyi';
  title: string;
  actorType: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  orderId?: string | null;
  actorId?: string | null;
  payload?: Record<string, unknown>;
  dedupeKey?: string | null;
  audience?: string | null;
}

interface RpcResult {
  error: { message?: string; code?: string } | null;
}

export interface ActivityRpc {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
}

export async function logActivityEvent(supabase: ActivityRpc, input: ActivityEventInput): Promise<void> {
  if (!input.organizationId || !input.type || !input.title) return;
  try {
    const { error } = await supabase.rpc('log_activity_event', {
      p_organization_id: input.organizationId,
      p_type: input.type,
      p_category: input.category,
      p_priority: input.priority,
      p_title: input.title,
      p_actor_type: input.actorType,
      p_body: input.body ?? null,
      p_entity_type: input.entityType ?? null,
      p_entity_id: input.entityId ?? null,
      p_order_id: input.orderId ?? null,
      p_actor_id: input.actorId ?? null,
      p_payload: input.payload ?? {},
      p_dedupe_key: input.dedupeKey ?? null,
      p_audience: input.audience ?? 'all',
    });
    if (error) console.error('activity event skipped', error.code ?? 'error');
  } catch {
    console.error('activity event skipped');
  }
}
