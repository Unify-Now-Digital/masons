import { supabase } from '@/shared/lib/supabase';

/**
 * Every address the org has connected as its own: gmail_connections.email_address
 * across ALL statuses (a revoked mailbox is still the org's) and
 * whatsapp_connections.whatsapp_from. Raw values; buildOwnHandles normalizes.
 * inbox_channel_accounts is deliberately not read (see useSelfHandles).
 */
export async function fetchOrgConnectedHandles(organizationId: string): Promise<string[]> {
  const [gmail, whatsapp] = await Promise.all([
    supabase.from('gmail_connections').select('email_address').eq('organization_id', organizationId),
    supabase.from('whatsapp_connections').select('whatsapp_from').eq('organization_id', organizationId),
  ]);
  if (gmail.error) throw gmail.error;
  if (whatsapp.error) throw whatsapp.error;
  return [
    ...(gmail.data ?? []).map((row) => row.email_address),
    ...(whatsapp.data ?? []).map((row) => row.whatsapp_from),
  ].filter((value): value is string => typeof value === 'string' && value.trim() !== '');
}
