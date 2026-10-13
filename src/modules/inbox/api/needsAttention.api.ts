import { supabase } from '@/shared/lib/supabase';
import type { InboxConversation } from '../types/inbox.types';
import { ownHandleKeepFilter, type OwnHandles } from '../utils/ownHandles';

/**
 * The needs-attention panel's own read (ruling 2026-10-13; reverses FR-016 /
 * R-006, which shared the inbox list's cache). Scored open conversations only,
 * highest priority first, so PostgREST's db-max-rows cap trims the least urgent
 * rows rather than the oldest open ones (SM had 1606 open on 2026-10-13).
 * Unlinked conversations on one of the org's own handles are excluded here;
 * linked ones are kept and de-duplicated by person in selectNeedsAttentionAll.
 */
export async function fetchNeedsAttentionConversations(
  organizationId: string,
  ownHandles: OwnHandles,
): Promise<InboxConversation[]> {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .not('ai_priority', 'is', null)
    .or(ownHandleKeepFilter(ownHandles))
    .order('ai_priority', { ascending: false })
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data || []) as InboxConversation[];
}
