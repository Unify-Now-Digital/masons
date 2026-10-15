import { useJobsPipeline } from '../hooks/useJobsPipeline';
import { useMoveJobStage } from '../hooks/useJobMutations';
import {
  BEFORE_PAID_STAGES,
  type BeforePaidStage,
  type PipelineJob,
} from '../types/jobsPipeline.types';
import { StageBoard } from './StageBoard';
import { UpNextList } from './UpNextList';
import { filterJobs, type PipelineFilter } from '../utils/pipelineView';

interface PipelineBoardProps {
  onExitJob?: (job: PipelineJob) => void;
  /** pipeline-v1 filters (Needs us / Gone quiet, Source). */
  filter?: PipelineFilter;
  source?: string | null;
  selectedJobId?: string | null;
  onSelectJob?: (jobId: string) => void;
}

export function PipelineBoard({ onExitJob, filter = 'all', source = null, selectedJobId, onSelectJob }: PipelineBoardProps) {
  const pipeline = useJobsPipeline();
  const { invoiceSummaries, isLoading, isError, error } = pipeline;
  const columns = {
    enquired: filterJobs(pipeline.columns.enquired, filter, source),
    quoted: filterJobs(pipeline.columns.quoted, filter, source),
    invoiced: filterJobs(pipeline.columns.invoiced, filter, source),
  };
  const allJobs = [...columns.enquired, ...columns.quoted, ...columns.invoiced];
  const moveMutation = useMoveJobStage();

  const move = (job: PipelineJob, direction: 1 | -1) => {
    const stage = job.stage as BeforePaidStage;
    const toStage = BEFORE_PAID_STAGES[BEFORE_PAID_STAGES.indexOf(stage) + direction];
    if (!toStage) return;
    moveMutation.mutate({ jobId: job.id, fromStage: stage, toStage });
  };

  const hasAny = BEFORE_PAID_STAGES.some((s) => pipeline.columns[s].length > 0);
  return (
    <div className={hasAny || isLoading ? "flex flex-col gap-3 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:flex-1 lg:min-h-0" : "flex flex-col"}>
      {!isLoading && !isError && hasAny ? (
        <UpNextList jobs={allJobs} invoiceSummaries={invoiceSummaries} selectedJobId={selectedJobId} onSelectJob={onSelectJob} />
      ) : isLoading ? (
        <div className="hidden lg:block" />
      ) : null}
    <StageBoard
      showSummaries={hasAny}
      selectedJobId={selectedJobId}
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
    </div>
  );
}
