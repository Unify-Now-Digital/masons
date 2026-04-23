import { supabase } from '@/shared/lib/supabase';

function mapDeleteOrganizationError(err: { message: string; code?: string }): string {
  const { message, code } = err;
  const lower = message.toLowerCase();

  if (code === '42501' || lower.includes('must be an organisation admin')) {
    return 'You do not have permission to delete this organisation.';
  }
  if (code === '28000' || lower.includes('must be authenticated')) {
    return 'You must be signed in to delete an organisation.';
  }
  if (lower.includes('organisation not found')) {
    return 'This organisation was not found.';
  }
  return message;
}

/** Admin-only: hard delete an organisation by id (RPC). */
export async function deleteOrganization(organizationId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_organization', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(mapDeleteOrganizationError(error));
}
