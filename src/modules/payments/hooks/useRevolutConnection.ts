import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { RevolutConnection } from '../types/reconciliation.types';

export const revolutKeys = {
  connection: (organizationId: string | null) => ['revolut-connection', organizationId] as const,
};

async function fetchRevolutConnection(organizationId: string): Promise<RevolutConnection | null> {
  const { data, error } = await supabase
    .from('revolut_connections_safe')
    .select('id, organization_id, user_id, client_id, status, environment, token_expires_at, refresh_token_expires_at, webhook_id, last_synced_at, last_sync_error, created_at, updated_at')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw error;
  return data as RevolutConnection | null;
}

export function useRevolutConnection() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: revolutKeys.connection(organizationId ?? null),
    queryFn: () => fetchRevolutConnection(organizationId!),
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });
}
