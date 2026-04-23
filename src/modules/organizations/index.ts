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

export {
  addMemberByEmail,
  changeMemberRole,
  createOrganization,
  removeOrganizationMember,
} from "./api/organizationManagement.rpc";
export { CreateOrganizationModal } from "./components/CreateOrganizationModal";
export { OrgSwitcher } from "./components/OrgSwitcher";
export { OrganizationMemberRoleSelect } from "./components/OrganizationMemberRoleSelect";
export { OrganizationMembersPanel } from "./components/OrganizationMembersPanel";
export { useOrganizationMembers, organizationMembersKeys } from "./hooks/useOrganizationMembers";
