import { supabase } from '@/shared/lib/supabase';
import type { NeedsAttentionConversation } from '../utils/needsAttention';
import { ownHandleKeepFilter, type OwnHandles } from '../utils/ownHandles';

/**
 * The needs-attention panel's own read (ruling 2026-10-13; reverses FR-016 /
 * R-006, which shared the inbox list's cache). Scored open conversations only,
 * highest priority first, so PostgREST's db-max-rows cap trims the least urgent
 * rows rather than the oldest open ones (SM had 1606 open on 2026-10-13).
 * Unlinked conversations on one of the org's own handles are excluded here.
 * The linked person's email/phone ride along (`!person_id`: the same FK also
 * reaches the customers/customer_scores views) so selectNeedsAttentionAll can
 * drop own-handle rows whose person is ours too — a top-level `or` over an
 * embedded resource is PostgREST-version-dependent, so that test stays in code.
 */
export async function fetchNeedsAttentionConversations(
  organizationId: string,
  ownHandles: OwnHandles,
): Promise<NeedsAttentionConversation[]> {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .select('*, person:people!person_id(email, phone)')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .not('ai_priority', 'is', null)
    .or(ownHandleKeepFilter(ownHandles))
    .order('ai_priority', { ascending: false })
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data || []) as NeedsAttentionConversation[];
}

/**
 * Writes the dismissal marker; null clears it (undo). Org-guarded on top of RLS.
 * PostgREST reports an RLS-filtered update as success with zero rows, so zero
 * rows throws here rather than looking like a dismiss that worked.
 */
export async function setNeedsAttentionDismissedAt(
  organizationId: string,
  conversationId: string,
  value: string | null,
): Promise<void> {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .update({ ai_dismissed_at: value })
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Dismiss did not update the conversation');
}
