/**
 * Organizations module — public surface (types; UI and hooks added by feature tasks).
 */

export type {
  Organization,
  OrganizationMember,
  OrganizationMemberWithIdentity,
  OrganizationMembershipListItem,
  OrganizationRole,
} from "./types/organization.types";

export { OrgSwitcher } from "./components/OrgSwitcher";
export { OrganizationMembersPanel } from "./components/OrganizationMembersPanel";
export { useOrganizationMembers, organizationMembersKeys } from "./hooks/useOrganizationMembers";
