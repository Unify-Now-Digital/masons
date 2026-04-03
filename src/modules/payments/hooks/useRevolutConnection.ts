import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { RevolutConnection } from '../types/reconciliation.types';

export const revolutKeys = {
  connection: ['revolut-connection'] as const,
};

async function fetchRevolutConnection(): Promise<RevolutConnection | null> {
  const { data, error } = await supabase
    .from('revolut_connections')
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
