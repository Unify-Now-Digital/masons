import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { RevolutConnection } from '../types/reconciliation.types';

export const revolutKeys = {
  connection: ['revolut-connection'] as const,
};

async function fetchRevolutConnection(): Promise<RevolutConnection | null> {
  // Use the safe view that excludes tokens and signing secrets
  const { data, error } = await supabase
    .from('revolut_connections_safe')
    .select('*')
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data as RevolutConnection | null;
}

export function useRevolutConnection() {
  return useQuery({
    queryKey: revolutKeys.connection,
    queryFn: fetchRevolutConnection,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
