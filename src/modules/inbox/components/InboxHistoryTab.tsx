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
            <span className="text-[11px] text-gardens-txs">
              Created {formatDateDMY(job.created_at)}
            </span>
          </div>
          {job.paid_at && (
            <p className="text-[11px] font-medium text-gardens-tx">
              Paid {formatDateDMY(job.paid_at)}
            </p>
          )}
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
