import { AlertCircle, Inbox } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useJobsPipeline } from '../hooks/useJobsPipeline';
import { useMoveJobStage } from '../hooks/useJobMutations';
import {
  BEFORE_PAID_STAGES,
  type BeforePaidStage,
  type PipelineJob,
} from '../types/jobsPipeline.types';
import { PipelineColumn } from './PipelineColumn';
import { PipelineJobCard } from './PipelineJobCard';

const STAGE_LABEL: Record<BeforePaidStage, string> = {
  enquired: 'Enquired',
  quoted: 'Quoted',
  invoiced: 'Invoiced',
};

interface PipelineBoardProps {
  onExitJob?: (job: PipelineJob) => void;
}

export function PipelineBoard({ onExitJob }: PipelineBoardProps) {
  const { columns, invoiceSummaries, isLoading, isError, error } = useJobsPipeline();
  const moveMutation = useMoveJobStage();

  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-gardens-bdr p-3 space-y-2">
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

  const total = BEFORE_PAID_STAGES.reduce((n, stage) => n + columns[stage].length, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gardens-bdr px-6 py-16 text-center">
        <Inbox className="h-10 w-10 text-gardens-txm opacity-60" aria-hidden />
        <p className="text-sm font-medium text-gardens-tx">No active jobs in the pipeline</p>
        <p className="text-xs text-gardens-txs max-w-sm">
          Add a conversation to the pipeline from the Inbox to get started.
        </p>
      </div>
    );
  }

  const move = (job: PipelineJob, direction: 1 | -1) => {
    const stage = job.stage as BeforePaidStage;
    const toStage = BEFORE_PAID_STAGES[BEFORE_PAID_STAGES.indexOf(stage) + direction];
    if (!toStage) return;
    moveMutation.mutate({ jobId: job.id, fromStage: stage, toStage });
  };

  return (
    <div className="grid gap-3 lg:grid-cols-3 min-h-[420px]">
      {BEFORE_PAID_STAGES.map((stage) => (
        <PipelineColumn key={stage} label={STAGE_LABEL[stage]} count={columns[stage].length}>
          {columns[stage].map((job) => {
            const stageIdx = BEFORE_PAID_STAGES.indexOf(stage);
            const nextStage = BEFORE_PAID_STAGES[stageIdx + 1];
            const needsInvoiceGate =
              nextStage === 'invoiced' && !(invoiceSummaries.get(job.id)?.count ?? 0);
            return (
              <PipelineJobCard
                key={job.id}
                job={job}
                invoiceSummary={invoiceSummaries.get(job.id)}
                onMoveBack={stageIdx > 0 ? () => move(job, -1) : undefined}
                onMoveForward={nextStage ? () => move(job, 1) : undefined}
                moveForwardDisabled={needsInvoiceGate}
                moveForwardDisabledReason="Needs a linked invoice"
                onExit={onExitJob ? () => onExitJob(job) : undefined}
                isMoving={moveMutation.isPending}
              />
            );
          })}
        </PipelineColumn>
      ))}
    </div>
  );
}
