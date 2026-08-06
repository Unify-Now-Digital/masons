import { useAfterPaidPipeline } from '../hooks/useAfterPaidPipeline';
import { AFTER_PAID_STAGES, type PipelineJob } from '../types/jobsPipeline.types';
import { StageBoard } from './StageBoard';

interface AfterPaidBoardProps {
  onExitJob?: (job: PipelineJob) => void;
}

export function AfterPaidBoard({ onExitJob }: AfterPaidBoardProps) {
  const { columns, invoiceSummaries, isLoading, isError, error } = useAfterPaidPipeline();

  return (
    <StageBoard
      stages={AFTER_PAID_STAGES}
      columns={columns}
      invoiceSummaries={invoiceSummaries}
      isLoading={isLoading}
      isError={isError}
      error={error}
      cardWarning={(job) => (job.paid_at === null ? 'Not marked paid' : null)}
      onExitJob={onExitJob}
      emptyState={{
        title: 'No jobs after payment yet',
        hint: 'Jobs appear here once confirmed after payment.',
      }}
    />
  );
}
