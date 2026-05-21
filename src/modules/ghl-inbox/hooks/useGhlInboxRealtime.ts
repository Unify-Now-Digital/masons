import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { ghlInboxKeys } from '../api/ghlInbox.keys';

const REALTIME_DEBOUNCE_MS = 400;

export function useGhlInboxRealtime(activeConversationId: string | null) {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    const flush = () => {
      debounceRef.current = null;
      queryClient.invalidateQueries({ queryKey: ghlInboxKeys.conversations(organizationId) });
      if (activeConversationId) {
        queryClient.invalidateQueries({
          queryKey: ghlInboxKeys.messages(organizationId, activeConversationId),
        });
      }
    };

    const schedule = () => {
      if (debounceRef.current) return;
      debounceRef.current = setTimeout(flush, REALTIME_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`ghl-inbox:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ghl_connections',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => schedule(),
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, organizationId, activeConversationId]);
}
