import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

/**
 * Same rule as public.user_can_view_org_finance:
 * - organisation with an owner set: only the owner sees money
 * - organisation with no owner: admin and member see money (previous behaviour)
 * `admin` must be a service-role client. Fails closed on any error.
 */
export async function memberCanSeeMoney(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data: me, error } = await admin
    .from('organization_members')
    .select('role, is_owner')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || !me) return false;
  if (me.is_owner === true) return true;
  const { count, error: ownerErr } = await admin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('is_owner', true);
  if (ownerErr || count === null) return false;
  if (count > 0) return false;
  return me.role === 'admin' || me.role === 'member';
}
