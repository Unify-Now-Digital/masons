import { AlertCircle, Inbox } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { JobInvoiceSummary, JobStage, PipelineJob } from '../types/jobsPipeline.types';
import { formatStageLabel } from '../utils/display';
import { PipelineColumn } from './PipelineColumn';
import { PipelineJobCard } from './PipelineJobCard';

// Tailwind needs literal class names — no template interpolation.
const GRID_COLS: Record<number, string> = {
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

interface StageBoardProps {
  /** Ordered stage list — array order is column order and move adjacency. */
  stages: readonly JobStage[];
  columns: Partial<Record<JobStage, PipelineJob[]>>;
  invoiceSummaries: Map<string, JobInvoiceSummary>;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** Absent ⇒ cards render without move buttons. */
  onMove?: (job: PipelineJob, direction: 1 | -1) => void;
  isMoving?: boolean;
  /** Returns the disabled-reason for a forward move, or null to allow it. */
  moveForwardGate?: (job: PipelineJob, nextStage: JobStage) => string | null;
  /** Returns a warning label to show on a card, or null for none. */
  cardWarning?: (job: PipelineJob) => string | null;
  onExitJob?: (job: PipelineJob) => void;
  emptyState: { title: string; hint: string };
}

export function StageBoard({
  stages,
  columns,
  invoiceSummaries,
  isLoading,
  isError,
  error,
  onMove,
  isMoving,
  moveForwardGate,
  onExitJob,
  emptyState,
}: StageBoardProps) {
  const gridCols = GRID_COLS[stages.length] ?? 'lg:grid-cols-3';

  if (isLoading) {
    return (
      <div className={`grid gap-3 ${gridCols}`}>
        {stages.map((stage) => (
          <div key={stage} className="rounded-lg border border-gardens-bdr p-3 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-gardens-bdr bg-gardens-red-lt/30 px-6 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-gardens-red-dk" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium text-gardens-tx">Could not load the pipeline</p>
          <p className="text-xs text-gardens-txs max-w-md">
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </p>
        </div>
      </div>
    );
  }

  const total = stages.reduce((n, stage) => n + (columns[stage]?.length ?? 0), 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gardens-bdr px-6 py-16 text-center">
        <Inbox className="h-10 w-10 text-gardens-txm opacity-60" aria-hidden />
        <p className="text-sm font-medium text-gardens-tx">{emptyState.title}</p>
        <p className="text-xs text-gardens-txs max-w-sm">{emptyState.hint}</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${gridCols} min-h-[420px]`}>
      {stages.map((stage, stageIdx) => {
        const jobs = columns[stage] ?? [];
        const nextStage = stages[stageIdx + 1];
        return (
          <PipelineColumn key={stage} label={formatStageLabel(stage)} count={jobs.length}>
            {jobs.map((job) => {
              const gateReason =
                nextStage && moveForwardGate ? moveForwardGate(job, nextStage) : null;
              return (
                <PipelineJobCard
                  key={job.id}
                  job={job}
                  invoiceSummary={invoiceSummaries.get(job.id)}
                  onMoveBack={onMove && stageIdx > 0 ? () => onMove(job, -1) : undefined}
                  onMoveForward={onMove && nextStage ? () => onMove(job, 1) : undefined}
                  moveForwardDisabled={!!gateReason}
                  moveForwardDisabledReason={gateReason ?? undefined}
                  onExit={onExitJob ? () => onExitJob(job) : undefined}
                  isMoving={isMoving}
                />
              );
            })}
          </PipelineColumn>
        );
      })}
    </div>
  );
}
