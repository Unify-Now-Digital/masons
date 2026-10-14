import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

/** Server-side feature flag (public.app_feature_flags via feature_enabled). Fails closed. */
export async function featureEnabled(service: SupabaseClient, key: string): Promise<boolean> {
  const { data, error } = await service.rpc('feature_enabled', { p_key: key });
  if (error) {
    console.error('feature flag lookup failed', key, error.code);
    return false;
  }
  return data === true;
}

export const REVOLUT_FLAG = 'revolut_ledger';
