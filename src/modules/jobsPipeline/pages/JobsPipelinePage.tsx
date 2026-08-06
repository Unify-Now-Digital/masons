import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { AfterPaidBoard } from '../components/AfterPaidBoard';
import { ExitJobModal } from '../components/ExitJobModal';
import { ExitedJobsList } from '../components/ExitedJobsList';
import { PipelineBoard } from '../components/PipelineBoard';
import { useAfterPaidPipeline } from '../hooks/useAfterPaidPipeline';
import { useDueDormantCount } from '../hooks/useExitedJobs';
import { useJobsPipeline } from '../hooks/useJobsPipeline';
import {
  AFTER_PAID_STAGES,
  BEFORE_PAID_STAGES,
  type PipelineJob,
} from '../types/jobsPipeline.types';

type PipelineView = 'before' | 'after' | 'exited';

export function JobsPipelinePage() {
  const [view, setView] = useState<PipelineView>('before');
  const [exitingJob, setExitingJob] = useState<PipelineJob | null>(null);
  const { data: dueDormantCount = 0 } = useDueDormantCount();

  // Cache-deduped with the boards' own hook calls (same query keys) — counts
  // stay live for both tabs without extra network traffic.
  const beforePipeline = useJobsPipeline();
  const afterPipeline = useAfterPaidPipeline();
  const beforeTotal = BEFORE_PAID_STAGES.reduce(
    (n, stage) => n + beforePipeline.columns[stage].length,
    0,
  );
  const afterTotal = AFTER_PAID_STAGES.reduce(
    (n, stage) => n + afterPipeline.columns[stage].length,
    0,
  );

  const tabs: { value: PipelineView; label: string }[] = [
    {
      value: 'before',
      label: beforePipeline.isLoading ? 'Before payment' : `Before payment (${beforeTotal})`,
    },
    {
      value: 'after',
      label: afterPipeline.isLoading ? 'After payment' : `After payment (${afterTotal})`,
    },
    {
      value: 'exited',
      label: dueDormantCount > 0 ? `Exited (${dueDormantCount} due)` : 'Exited',
    },
  ];

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-head text-xl sm:text-2xl font-semibold text-gardens-tx tracking-tight">
            Pipeline
          </h1>
          <p className="text-sm text-gardens-txs mt-1">
            Jobs from first enquiry through to completion.
          </p>
        </div>
        <div className="flex items-center rounded-md border border-gardens-bdr p-0.5 bg-gardens-page/60">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setView(tab.value)}
              className={cn(
                'h-7 rounded px-3 text-xs font-medium transition-colors',
                view === tab.value
                  ? 'bg-background text-gardens-tx shadow-sm'
                  : 'text-gardens-txs hover:text-gardens-tx',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'before' ? (
        <PipelineBoard onExitJob={setExitingJob} />
      ) : view === 'after' ? (
        <AfterPaidBoard onExitJob={setExitingJob} />
      ) : (
        <ExitedJobsList />
      )}

      <ExitJobModal job={exitingJob} onClose={() => setExitingJob(null)} />
    </div>
  );
}
