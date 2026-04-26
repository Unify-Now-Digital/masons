import { supabase } from '@/shared/lib/supabase';
import type { OrganizationMemberWithIdentity, OrganizationRole } from '@/modules/organizations';
import { changeMemberRole, removeOrganizationMember } from './organizationManagement.rpc';

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
  organizationId: string,
  userId: string,
  role: OrganizationRole,
): Promise<void> {
  await changeMemberRole(organizationId, userId, role);
}

export async function removeMember(organizationId: string, userId: string): Promise<void> {
  await removeOrganizationMember(organizationId, userId);
}
