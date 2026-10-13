import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';

/**
 * Rail badge for Inbox: number of open conversations with unread messages.
 * Read-only head count (no rows fetched), org-scoped like fetchConversations.
 * Refetches every minute; a failure just hides the badge.
 */
export async function fetchInboxUnreadCount(organizationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('inbox_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .gt('unread_count', 0);
  if (error) throw error;
  return count ?? 0;
}

export function useInboxUnreadCount(): number {
  const { organizationId } = useOrganization();
  const { data } = useQuery({
    queryKey: ['shell', 'inbox-unread-count', organizationId],
    queryFn: () => fetchInboxUnreadCount(organizationId as string),
    enabled: !!organizationId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return data ?? 0;
}
