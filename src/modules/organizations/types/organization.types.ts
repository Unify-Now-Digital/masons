/**
 * Organization tenancy types — aligned with specs/002-multi-org-tenancy/contracts/organization-context.md
 */

export type OrganizationRole = "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
}

/** Member row including identity from auth.users (via RPC). */
export interface OrganizationMemberWithIdentity extends OrganizationMember {
  email: string | null;
  display_name: string | null;
}

export interface OrganizationMembershipListItem {
  organizationId: string;
  name: string;
  role: OrganizationRole;
}
