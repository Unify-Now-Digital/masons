import { supabase } from '@/shared/lib/supabase';
import type { OrganizationMemberWithIdentity, OrganizationRole } from '@/modules/organizations';

/**
 * Members of an organisation with email and display name from auth.users (database RPC).
 */
export async function fetchOrganizationMembers(organizationId: string): Promise<OrganizationMemberWithIdentity[]> {
  const { data, error } = await supabase.rpc('get_organization_members_with_identity', {
    p_organization_id: organizationId,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    role: row.role as OrganizationMemberWithIdentity['role'],
    created_at: row.created_at,
    email: row.email ?? null,
    display_name: row.display_name ?? null,
  }));
}

export async function updateMemberRole(
  memberId: string,
  role: OrganizationRole,
): Promise<void> {
  const { error } = await supabase.from('organization_members').update({ role }).eq('id', memberId);
  if (error) throw new Error(error.message);
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('organization_members').delete().eq('id', memberId);
  if (error) throw new Error(error.message);
}
