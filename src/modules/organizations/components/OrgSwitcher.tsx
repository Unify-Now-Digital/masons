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

  if (memberships.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mt-0.5 flex items-center gap-1 rounded px-1 py-0.5 text-left font-body text-[9px] font-medium uppercase tracking-[0.08em] text-white/[0.55] hover:bg-white/[0.06] hover:text-white/[0.75]"
        >
          <span className="truncate max-w-[140px]">{organizationName ?? 'Workspace'}</span>
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
