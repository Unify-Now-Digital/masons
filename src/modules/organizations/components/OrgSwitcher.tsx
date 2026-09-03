import { ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useOrganization } from '@/shared/context/OrganizationContext';

export function OrgSwitcher() {
  const { organizationId, organizationName, memberships, setActiveOrganizationId } = useOrganization();

  if (memberships.length <= 1) {
    return (
      <div className="mt-0.5 px-1 py-0.5 text-left font-body text-[9px] font-medium uppercase tracking-[0.08em] text-gardens-nav-section">
        {/* max-w 92, not 140 (C8 2026-09-03): the declared cap must fit the sidebar
            header's 118px text block — see the width comment in Sidebar.tsx. The
            dropdown branch below needs 92 + px-1 8 + gap-1 4 + chevron 12 = 116, i.e.
            2px of cushion, because every term is estimated from font advances rather
            than measured. At 140 the block wanted 164 and overflowed the header at 220
            too: latent, hidden only because no live org name is that long. */}
        <span className="truncate max-w-[92px] block">{organizationName ?? 'Workspace'}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mt-0.5 flex items-center gap-1 rounded px-1 py-0.5 text-left font-body text-[9px] font-medium uppercase tracking-[0.08em] text-gardens-nav-section hover:bg-white/[0.06] hover:text-gardens-nav-section"
        >
          <span className="truncate max-w-[92px]">{organizationName ?? 'Workspace'}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.organizationId}
            onSelect={() => setActiveOrganizationId(m.organizationId)}
            className={m.organizationId === organizationId ? 'font-medium' : undefined}
          >
            {m.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
