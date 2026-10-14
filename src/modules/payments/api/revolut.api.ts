import { supabase } from '@/shared/lib/supabase';

/**
 * Trigger a manual sync of Revolut transactions.
 * Invokes the revolut-sync-transactions Edge Function.
 */
export async function syncRevolutTransactions(organizationId: string): Promise<{ synced: number }> {
  // Imports into the payments ledger; matching happens in the database.
  const { data, error } = await supabase.functions.invoke<{ ingested?: number; synced?: number }>(
    'revolut-sync-transactions',
    { body: { organization_id: organizationId } },
  );

  if (error) {
    throw new Error(error.message || 'Failed to sync Revolut transactions');
  }

  return { synced: data?.ingested ?? data?.synced ?? 0 };
}

/**
 * Trigger a manual refresh of the Revolut access token.
 */
export async function refreshRevolutToken(): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke<{ success: boolean }>(
    'revolut-token-refresh'
  );

  if (error) {
    throw new Error(error.message || 'Failed to refresh Revolut token');
  }

  return data ?? { success: false };
}
