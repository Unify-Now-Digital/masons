import { useMemo, useState } from 'react';
import { Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Pill, type PillTone } from '@/shared/components/gardens';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { useExitedJobs } from '../hooks/useExitedJobs';
import type { JobExitReason, PipelineJob } from '../types/jobsPipeline.types';
import { formatShortDate, getJobDisplayName } from '../utils/display';

type ReasonFilter = 'all' | JobExitReason;

const FILTERS: { value: ReasonFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'lost', label: 'Lost' },
  { value: 'closed', label: 'Closed' },
  { value: 'dormant', label: 'Dormant' },
];

const REASON_TONES: Record<string, PillTone> = {
  lost: 'red',
  closed: 'neutral',
  dormant: 'amber',
  on_hold: 'blue',
  cancelled: 'red',
};

export function ExitedJobsList() {
  const { data: jobs, isLoading, isError, error } = useExitedJobs();
  const [filter, setFilter] = useState<ReasonFilter>('all');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!jobs) return [];
    if (filter === 'all') return jobs;
    return jobs.filter((job) => job.exit_reason === filter);
  }, [jobs, filter]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-gardens-bdr bg-gardens-red-lt/30 px-6 py-8 text-center">
        <p className="text-sm font-medium text-gardens-tx">Could not load exited jobs</p>
        <p className="text-xs text-gardens-txs mt-1">
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </p>
      </div>
    );
  }

  const openConversation = (job: PipelineJob) => {
    if (job.conversation?.id) {
      navigate(`/dashboard/inbox?conversation=${encodeURIComponent(job.conversation.id)}`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              'h-6 rounded-full px-2.5 text-[11px] font-medium transition-colors',
              filter === value
                ? 'bg-gardens-acc-lt text-gardens-acc-dk'
                : 'bg-gardens-page text-gardens-txs hover:bg-gardens-sidebar-hover/60',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gardens-bdr px-6 py-16 text-center">
          <Archive className="h-10 w-10 text-gardens-txm opacity-60" aria-hidden />
          <p className="text-sm font-medium text-gardens-tx">
            {filter === 'all' ? 'No exited jobs yet' : `No ${filter} jobs`}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gardens-bdr divide-y divide-gardens-bdr overflow-hidden">
          {filtered.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => openConversation(job)}
              disabled={!job.conversation?.id}
              className="w-full text-left px-3 py-2.5 flex items-center gap-3 bg-background hover:bg-gardens-sidebar-hover/40 disabled:cursor-default disabled:hover:bg-background"
              title={job.conversation?.id ? 'Open conversation in Inbox' : 'No linked conversation'}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gardens-tx truncate">
                  {getJobDisplayName(job)}
                </div>
                <div className="text-[11px] text-gardens-txs">
                  Exited {formatShortDate(job.exited_at)}
                  {job.wake_at ? (
                    <span className="text-gardens-txm"> · wakes {formatShortDate(job.wake_at)}</span>
                  ) : null}
                </div>
              </div>
              {job.exit_reason ? (
                <Pill tone={REASON_TONES[job.exit_reason] ?? 'neutral'}>{job.exit_reason}</Pill>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
