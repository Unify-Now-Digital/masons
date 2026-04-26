import { supabase } from '@/shared/lib/supabase';

const MAX_BULK_DELETE = 50;

function mapDeleteConversationsError(err: { message: string; code?: string }): string {
  const { message, code } = err;
  const lower = message.toLowerCase();

  if (code === '28000' || lower.includes('must be authenticated')) {
    return 'You must be signed in to delete conversations.';
  }
  if (code === '42501' || lower.includes('outside your organisation access')) {
    return 'You cannot delete conversations outside your organisation.';
  }
  if (lower.includes('more than 50')) {
    return 'You can delete up to 50 conversations at once.';
  }
  if (lower.includes('not found')) {
    return 'One or more selected conversations were not found.';
  }

  return message;
}

/** Member-scoped bulk delete via SECURITY DEFINER RPC. Returns deleted row count. */
export async function deleteConversationsRpc(conversationIds: string[]): Promise<number> {
  if (conversationIds.length === 0) return 0;
  const uniqueConversationIds = Array.from(new Set(conversationIds));
  let totalDeleted = 0;

  for (let i = 0; i < uniqueConversationIds.length; i += MAX_BULK_DELETE) {
    const batch = uniqueConversationIds.slice(i, i + MAX_BULK_DELETE);
    const { data, error } = await supabase.rpc('delete_conversations', {
      p_conversation_ids: batch,
    });
    if (error) throw new Error(mapDeleteConversationsError(error));
    totalDeleted += Number(data ?? 0);
  }

  return totalDeleted;
}
