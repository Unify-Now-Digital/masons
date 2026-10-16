import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';
import { timingSafeEqual } from './revolut/webhookSignature.ts';

export const OWNER_INVOICING_ERROR = 'Only the owner can use invoicing';

/**
 * Service-role bearer (Make, n8n, other functions) is allowed.
 * A user JWT is allowed only when organization_members.is_owner is true.
 */
export async function denyUnlessOwner(
  req: Request,
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (token && service && timingSafeEqual(token, service)) return null;

  const user = await getUserFromRequest(req);
  if (!user) return OWNER_INVOICING_ERROR;

  const { data, error } = await admin
    .from('organization_members')
    .select('is_owner')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || data?.is_owner !== true) return OWNER_INVOICING_ERROR;
  return null;
}
