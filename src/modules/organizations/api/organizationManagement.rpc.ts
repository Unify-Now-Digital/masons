import { supabase } from '@/shared/lib/supabase';
import type { OrganizationRole } from '@/modules/organizations';

function mapOrgRpcError(err: { message: string; code?: string }): string {
  const { message, code } = err;
  if (code === '42501' || message.toLowerCase().includes('must be an organisation admin')) {
    return 'You do not have permission to do that for this organisation.';
  }
  return message;
}

/** Creates a new organisation and returns its id; caller becomes admin (RPC). */
export async function createOrganization(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_organization', { p_name: name });
  if (error) throw new Error(mapOrgRpcError(error));
  if (data == null || data === '') throw new Error('No organisation id returned');
  return data as string;
}

/** Admin-only: add an existing user by email as a member (idempotent if already a member). */
export async function addMemberByEmail(organizationId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc('add_organization_member_by_email', {
    p_organization_id: organizationId,
    p_email: email,
  });
  if (error) throw new Error(mapOrgRpcError(error));
}

/** Admin-only: remove membership for `userId` in `organizationId`. */
export async function removeOrganizationMember(organizationId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_organization_member', {
    p_organization_id: organizationId,
    p_user_id: userId,
  });
  if (error) throw new Error(mapOrgRpcError(error));
}

/** Admin-only: set member role in `organizationId`. */
export async function changeMemberRole(
  organizationId: string,
  userId: string,
  role: OrganizationRole,
): Promise<void> {
  const { error } = await supabase.rpc('change_member_role', {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw new Error(mapOrgRpcError(error));
}
