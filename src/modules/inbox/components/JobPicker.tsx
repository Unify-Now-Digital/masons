import React, { useMemo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { Order } from '@/modules/orders/types/orders.types';
import {
  buildJobPickerEntries,
  type PickerJob,
} from '@/modules/inbox/utils/jobPickerLabels';

interface JobPickerProps {
  /** Newest first, as fetched — display order is not re-sorted here (FR-1). */
  jobs: PickerJob[];
  /** Newest order per job (label source, D1). */
  ordersByJobId: Map<string, Order>;
  /** Parent guarantees an id that exists in `jobs` when rendering the picker. */
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
}

/** FR-1 job picker. The PARENT renders this only at 2+ jobs (D2); 0-1 jobs keep the static chip. */
export const JobPicker: React.FC<JobPickerProps> = ({
  jobs,
  ordersByJobId,
  selectedJobId,
  onSelectJob,
}) => {
  const entries = useMemo(
    () => buildJobPickerEntries(jobs, ordersByJobId),
    [jobs, ordersByJobId],
  );
  const selected = entries.find((e) => e.job.id === selectedJobId) ?? entries[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Select job"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gardens-page text-gardens-tx border border-gardens-bdr shrink-0 hover:bg-gardens-bdr/50 focus:outline-none focus:ring-2 focus:ring-gardens-grn/30"
      >
        <span className="max-w-[220px] truncate">{selected.label}</span>
        {selected.isExited && <Badge variant="grey">Exited</Badge>}
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {entries.map((entry) => (
          <DropdownMenuItem
            key={entry.job.id}
            onSelect={() => onSelectJob(entry.job.id)}
            className="gap-2"
          >
            <Check
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                entry.job.id === selectedJobId ? 'opacity-100' : 'opacity-0',
              )}
            />
            <span className="truncate text-[12px]">{entry.label}</span>
            {entry.isExited && <Badge variant="grey">Exited</Badge>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
