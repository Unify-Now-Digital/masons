import type { OrganizationMemberWithIdentity } from '@/modules/organizations';
import { useOrganizationMembers } from '@/modules/organizations/hooks/useOrganizationMembers';
import { useOrganization } from '@/shared/context/OrganizationContext';

function memberPrimaryLabel(m: OrganizationMemberWithIdentity): string {
  const name = m.display_name?.trim();
  if (name) return name;
  const email = m.email?.trim();
  if (email) return email;
  return m.user_id;
}

function memberSecondaryLine(m: OrganizationMemberWithIdentity): string | null {
  const name = m.display_name?.trim();
  const email = m.email?.trim();
  if (name && email && name.toLowerCase() !== email.toLowerCase()) return email;
  return null;
}

export function OrganizationMembersPanel() {
  const { role } = useOrganization();
  const { data: members, isLoading, isError } = useOrganizationMembers();

  if (role !== 'admin') return null;

  return (
    <div className="rounded-lg border border-gardens-bdr bg-gardens-surf p-4 space-y-2">
      <h3 className="font-head text-sm font-semibold text-gardens-tx">Organisation members</h3>
      {isLoading && <p className="font-body text-xs text-gardens-txm">Loading…</p>}
      {isError && <p className="font-body text-xs text-destructive">Could not load members.</p>}
      {members && members.length > 0 && (
        <ul className="space-y-1">
          {members.map((m) => {
            const secondary = memberSecondaryLine(m);
            return (
              <li key={m.id} className="font-body text-xs text-gardens-tx flex justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-gardens-tx">{memberPrimaryLabel(m)}</div>
                  {secondary && (
                    <div className="truncate text-[11px] text-gardens-txs">{secondary}</div>
                  )}
                </div>
                <span className="shrink-0 text-gardens-txm capitalize">{m.role}</span>
              </li>
            );
          })}
        </ul>
      )}
      {members && members.length === 0 && (
        <p className="font-body text-xs text-gardens-txm">No members listed.</p>
      )}
    </div>
  );
}
