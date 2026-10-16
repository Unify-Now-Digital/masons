import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { toast } from '@/shared/hooks/use-toast';
import { unreadActionCount, type FeedEvent, type FeedFilter } from '../feed';

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || message.includes('schema cache') || message.includes('does not exist');
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function useActivityFeed(subscribe = false) {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FeedFilter>('all');

  const eventsQuery = useQuery({
    queryKey: ['activity-events', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, type, category, priority, entity_type, entity_id, order_id, actor_type, title, body, payload, created_at, resolved_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        if (isMissingRelation(error)) return { events: [] as FeedEvent[], unavailable: true };
        throw error;
      }
      return { events: (data ?? []) as FeedEvent[], unavailable: false };
    },
  });

  const readsQuery = useQuery({
    queryKey: ['activity-reads', organizationId],
    enabled: !!organizationId && !eventsQuery.data?.unavailable,
    queryFn: async () => {
      const userId = await currentUserId();
      if (!userId) return [] as string[];
      const { data, error } = await supabase
        .from('activity_event_reads')
        .select('event_id')
        .eq('user_id', userId);
      if (error) {
        if (isMissingRelation(error)) return [] as string[];
        throw error;
      }
      return (data ?? []).map((row) => row.event_id as string);
    },
  });

  useEffect(() => {
    if (!subscribe || !organizationId) return;
    const channel = supabase
      .channel(`activity-events-${organizationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_events', filter: `organization_id=eq.${organizationId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['activity-events', organizationId] });
          const row = payload.new as Partial<FeedEvent>;
          if (row.priority === 'action' && row.title) toast({ title: row.title });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [subscribe, organizationId, queryClient]);

  const markRead = useMutation({
    mutationFn: async (eventId: string) => {
      const userId = await currentUserId();
      if (!userId) return;
      const { error } = await supabase
        .from('activity_event_reads')
        .upsert({ event_id: eventId, user_id: userId }, { onConflict: 'event_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activity-reads', organizationId] }),
  });

  const resolve = useMutation({
    mutationFn: async (eventId: string) => {
      if (!organizationId) return;
      const { error } = await supabase
        .from('activity_events')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', eventId)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activity-events', organizationId] }),
  });

  const events = eventsQuery.data?.events ?? [];
  const readIds = useMemo(() => new Set(readsQuery.data ?? []), [readsQuery.data]);
  const unread = unreadActionCount(events, readIds);

  const markAllRead = async () => {
    const userId = await currentUserId();
    if (!userId || events.length === 0) return;
    const rows = events.map((event) => ({ event_id: event.id, user_id: userId }));
    const { error } = await supabase.from('activity_event_reads').upsert(rows, { onConflict: 'event_id,user_id' });
    if (!error) queryClient.invalidateQueries({ queryKey: ['activity-reads', organizationId] });
  };

  return {
    events,
    readIds,
    filter,
    setFilter,
    unavailable: eventsQuery.data?.unavailable === true,
    unread,
    markRead: (id: string) => markRead.mutate(id),
    resolve: (id: string) => resolve.mutate(id),
    markAllRead,
  };
}

export function useActivityUnreadCount(): number {
  return useActivityFeed(true).unread;
}
