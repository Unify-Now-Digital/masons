/**
 * Tenant checks for Edge Functions using the service-role client.
 * See specs/002-multi-org-tenancy/contracts/edge-function-tenant.md
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

export type OrgRole = "admin" | "member";

export async function getMembership(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<{ role: OrgRole } | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return { role: data.role as OrgRole };
}

export async function isUserInOrganization(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const m = await getMembership(supabase, userId, organizationId);
  return m !== null;
}

/**
 * Resolves the tenant for a user when acting on a connection row that may carry `organization_id`.
 * Verifies membership before returning; falls back to the user's first membership when the connection has no org (legacy).
 */
export async function resolveOrganizationIdForUser(
  supabase: SupabaseClient,
  userId: string,
  connectionOrganizationId: string | null | undefined,
): Promise<string | null> {
  if (connectionOrganizationId) {
    const ok = await isUserInOrganization(supabase, userId, connectionOrganizationId);
    return ok ? connectionOrganizationId : null;
  }
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data?.organization_id) return null;
  return data.organization_id as string;
}
