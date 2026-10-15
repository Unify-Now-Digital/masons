import { supabase } from '@/shared/lib/supabase';

/**
 * Trigger a manual sync of Revolut transactions.
 * Invokes the revolut-sync-transactions Edge Function.
 */
export async function syncRevolutTransactions(organizationId: string): Promise<{ synced: number }> {
  const { data, error } = await supabase.functions.invoke<{ synced: number }>(
    'revolut-sync-transactions',
    { body: { organization_id: organizationId } },
  );

  if (error) {
    throw new Error(error.message || 'Failed to sync Revolut transactions');
  }

  return data ?? { synced: 0 };
}

/**
 * Trigger a manual refresh of the Revolut access token.
 */
export async function refreshRevolutToken(organizationId: string): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke<{ success: boolean }>(
    'revolut-token-refresh',
    { body: { organization_id: organizationId } },
  );

  if (error) {
    throw new Error(error.message || 'Failed to refresh Revolut token');
  }

  return data ?? { success: false };
}

export async function disconnectRevolut(organizationId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('revolut-disconnect', {
    body: { organization_id: organizationId },
  });
  if (error) throw new Error(error.message || 'Could not disconnect Revolut');
}
