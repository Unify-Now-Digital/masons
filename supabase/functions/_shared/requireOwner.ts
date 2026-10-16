import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';
import { timingSafeEqual } from './revolut/webhookSignature.ts';
import { memberCanSeeMoney } from './moneyAccess.ts';

export const OWNER_INVOICING_ERROR = 'Only the owner can use invoicing';

/**
 * Service-role bearer (Make, n8n, other functions) is allowed.
 * A user JWT is allowed only when the member may see money (owner, or admin/member in an org with no owner).
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

  if (!(await memberCanSeeMoney(admin, user.id, organizationId))) return OWNER_INVOICING_ERROR;
  return null;
}
