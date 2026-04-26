import React, { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { OrganizationMemberWithIdentity, OrganizationRole } from '@/modules/organizations';

function countAdmins(members: OrganizationMemberWithIdentity[]): number {
  return members.filter((m) => m.role === 'admin').length;
}

export interface OrganizationMemberRoleSelectProps {
  member: OrganizationMemberWithIdentity;
  members: OrganizationMemberWithIdentity[];
  value: OrganizationRole;
  onValueChange: (role: OrganizationRole) => void;
  disabled?: boolean;
}

/**
 * Role picker with a client-side mirror of the last-admin rule: sole admin cannot select Member
 * (server trigger still enforces if counts race).
 */
export function OrganizationMemberRoleSelect({
  member,
  members,
  value,
  onValueChange,
  disabled = false,
}: OrganizationMemberRoleSelectProps) {
  const soleAdminCannotDemote = useMemo(() => {
    const admins = countAdmins(members);
    return member.role === 'admin' && admins === 1;
  }, [member.role, members]);

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as OrganizationRole)}
      disabled={disabled}
    >
      <SelectTrigger
        className="h-7 w-[104px] border-gardens-bdr bg-gardens-page text-xs capitalize"
        aria-label={`Role for ${member.display_name ?? member.email ?? member.user_id}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-gardens-bdr bg-gardens-surf">
        <SelectItem value="admin" className="text-xs capitalize">
          Admin
        </SelectItem>
        <SelectItem value="member" disabled={soleAdminCannotDemote} className="text-xs capitalize">
          Member
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
