import React, { useMemo } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Check, HelpCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { OrganizationMemberWithIdentity, OrganizationRole } from '@/modules/organizations';

function countAdmins(members: OrganizationMemberWithIdentity[]): number {
  return members.filter((m) => m.role === 'admin').length;
}

const ROLE_OPTIONS: { value: OrganizationRole; label: string; help: string }[] = [
  {
    value: 'admin',
    label: 'Admin',
    help: 'Admin: full access. Manages members, integrations and organisation settings.',
  },
  {
    value: 'member',
    label: 'Member',
    help: 'Member: full access to work and finance. Cannot manage members, integrations or organisation settings.',
  },
  {
    value: 'staff',
    label: 'Staff',
    help: 'Staff: same as Member, without financial overviews (Finance totals, Reporting, Payments). Can still create and send invoices.',
  },
];

const stopItemSelect = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * Local copy of the shared SelectItem with a "?" help icon. The shared item renders ALL its
 * children inside ItemText, which the closed trigger mirrors; here only the label is in
 * ItemText, so the icon never reaches the trigger. The icon stops pointerdown/pointerup/click
 * so it cannot select the role (Radix selects on the Item's pointerup/click). Tooltip content
 * is portalled: inline it would be clipped by the select's overflow-hidden content box.
 * Disabled items are pointer-events-none, so they show no tooltip (accepted).
 */
function RoleItem({
  value,
  label,
  help,
  disabled,
}: {
  value: OrganizationRole;
  label: string;
  help: string;
  disabled?: boolean;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      disabled={disabled}
      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs capitalize outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="ml-auto flex items-center pl-3 text-gardens-txs"
            onPointerDown={stopItemSelect}
            onPointerUp={stopItemSelect}
            onClick={stopItemSelect}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipPrimitive.Portal>
          <TooltipContent side="right" className="max-w-[260px] text-xs">
            {help}
          </TooltipContent>
        </TooltipPrimitive.Portal>
      </Tooltip>
    </SelectPrimitive.Item>
  );
}

export interface OrganizationMemberRoleSelectProps {
  member: OrganizationMemberWithIdentity;
  members: OrganizationMemberWithIdentity[];
  value: OrganizationRole;
  onValueChange: (role: OrganizationRole) => void;
  disabled?: boolean;
}

/**
 * Role picker with a client-side mirror of the last-admin rule: sole admin cannot select any
 * non-admin role (server trigger still enforces if counts race).
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
        {ROLE_OPTIONS.map((option) => (
          <RoleItem
            key={option.value}
            {...option}
            // Sole admin: every non-admin item is disabled (the admin item is their current role).
            disabled={soleAdminCannotDemote && option.value !== 'admin'}
          />
        ))}
      </SelectContent>
    </Select>
  );
}
