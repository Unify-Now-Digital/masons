import { cn } from '@/shared/lib/utils';
import React from 'react';
import { Clock } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { formatStageLabel } from '@/modules/jobsPipeline';
import type { JobStage } from '@/modules/jobsPipeline';
import { formatDateDMY } from '@/shared/lib/formatters';

/** Structural subset of jobsPipeline's ConversationJobSummary (type not barrel-exported). */
export interface SidebarHistoryJob {
  id: string;
  stage: JobStage;
  exit_reason: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface InboxHistoryTabProps {
  /** jobsQuery.data verbatim: undefined = probe unresolved, [] = resolved-empty. */
  jobs: SidebarHistoryJob[] | undefined;
}

/** History tab body: the selection's jobs with dates, newest first (input order). */
export const InboxHistoryTab: React.FC<InboxHistoryTabProps> = ({ jobs }) => {
  // Probe disabled / not yet resolved — distinct from resolved-empty below.
  if (jobs === undefined) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-14 w-full rounded-xl bg-gardens-bdr/80" />
        <Skeleton className="h-14 w-full rounded-xl bg-gardens-bdr/80" />
        <Skeleton className="h-14 w-full rounded-xl bg-gardens-bdr/80" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <Clock className="h-5 w-5 text-gardens-txs" />
        <p className="text-sm text-gardens-txs">No jobs for this selection yet</p>
      </div>
    );
  }

  return (
    <>
      {jobs.map((job) => (
        <div
          key={job.id}
          className="rounded-xl bg-gardens-surf2 p-3.5 space-y-1.5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-[11px] font-medium text-gardens-txs px-2 py-0.5 rounded-md bg-gardens-page">
              {formatStageLabel(job.stage)}
            </span>
          </div>
          {/* Chronological (QA): backfilled jobs were created in Mason after the payment. */}
          <ol className="m-0 p-0 list-none space-y-0.5">
            {[
              { k: 'created', at: job.created_at, label: job.paid_at && job.paid_at < job.created_at ? 'Added to Mason' : 'Created' },
              ...(job.paid_at ? [{ k: 'paid', at: job.paid_at, label: 'Paid' }] : []),
            ]
              .sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0))
              .map((e) => (
                <li key={e.k} className={cn('text-[11px]', e.k === 'paid' ? 'font-medium text-gardens-tx' : 'text-gardens-txs')}>
                  {e.label} {formatDateDMY(e.at)}
                </li>
              ))}
          </ol>
          {job.exit_reason && (
            <p className="text-[11px] text-gardens-txs">
              Exited — {job.exit_reason.replace(/_/g, ' ')}
            </p>
          )}
        </div>
      ))}
    </>
  );
};
