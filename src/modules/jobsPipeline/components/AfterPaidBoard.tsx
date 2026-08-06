import { useAfterPaidPipeline } from '../hooks/useAfterPaidPipeline';
import { useMoveJobStage } from '../hooks/useJobMutations';
import {
  AFTER_PAID_STAGES,
  type AfterPaidStage,
  type PipelineJob,
} from '../types/jobsPipeline.types';
import { StageBoard } from './StageBoard';

interface AfterPaidBoardProps {
  onExitJob?: (job: PipelineJob) => void;
}

export function AfterPaidBoard({ onExitJob }: AfterPaidBoardProps) {
  const { columns, invoiceSummaries, isLoading, isError, error } = useAfterPaidPipeline();
  const moveMutation = useMoveJobStage();

  const move = (job: PipelineJob, direction: 1 | -1) => {
    const stage = job.stage as AfterPaidStage;
    const toStage = AFTER_PAID_STAGES[AFTER_PAID_STAGES.indexOf(stage) + direction];
    if (!toStage) return;
    moveMutation.mutate({ jobId: job.id, fromStage: stage, toStage });
  };

  return (
    <StageBoard
      stages={AFTER_PAID_STAGES}
      columns={columns}
      invoiceSummaries={invoiceSummaries}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onMove={move}
      isMoving={moveMutation.isPending}
      cardWarning={(job) => (job.paid_at === null ? 'Not marked paid' : null)}
      onExitJob={onExitJob}
      emptyState={{
        title: 'No jobs after payment yet',
        hint: 'Jobs appear here once confirmed after payment.',
      }}
    />
  );
}
