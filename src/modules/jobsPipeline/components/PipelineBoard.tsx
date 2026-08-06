import { useJobsPipeline } from '../hooks/useJobsPipeline';
import { useMoveJobStage } from '../hooks/useJobMutations';
import {
  BEFORE_PAID_STAGES,
  type BeforePaidStage,
  type PipelineJob,
} from '../types/jobsPipeline.types';
import { StageBoard } from './StageBoard';

interface PipelineBoardProps {
  onExitJob?: (job: PipelineJob) => void;
}

export function PipelineBoard({ onExitJob }: PipelineBoardProps) {
  const { columns, invoiceSummaries, isLoading, isError, error } = useJobsPipeline();
  const moveMutation = useMoveJobStage();

  const move = (job: PipelineJob, direction: 1 | -1) => {
    const stage = job.stage as BeforePaidStage;
    const toStage = BEFORE_PAID_STAGES[BEFORE_PAID_STAGES.indexOf(stage) + direction];
    if (!toStage) return;
    moveMutation.mutate({ jobId: job.id, fromStage: stage, toStage });
  };

  return (
    <StageBoard
      stages={BEFORE_PAID_STAGES}
      columns={columns}
      invoiceSummaries={invoiceSummaries}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onMove={move}
      isMoving={moveMutation.isPending}
      moveForwardGate={(job, nextStage) =>
        nextStage === 'invoiced' && !(invoiceSummaries.get(job.id)?.count ?? 0)
          ? 'Needs a linked invoice'
          : null
      }
      onExitJob={onExitJob}
      emptyState={{
        title: 'No active jobs in the pipeline',
        hint: 'Add a conversation to the pipeline from the Inbox to get started.',
      }}
    />
  );
}
