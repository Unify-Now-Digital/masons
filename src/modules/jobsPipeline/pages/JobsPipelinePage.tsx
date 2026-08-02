import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { ExitJobModal } from '../components/ExitJobModal';
import { ExitedJobsList } from '../components/ExitedJobsList';
import { PipelineBoard } from '../components/PipelineBoard';
import { useDueDormantCount } from '../hooks/useExitedJobs';
import type { PipelineJob } from '../types/jobsPipeline.types';

type PipelineView = 'active' | 'exited';

export function JobsPipelinePage() {
  const [view, setView] = useState<PipelineView>('active');
  const [exitingJob, setExitingJob] = useState<PipelineJob | null>(null);
  const { data: dueDormantCount = 0 } = useDueDormantCount();

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-head text-xl sm:text-2xl font-semibold text-gardens-tx tracking-tight">
            Pipeline
          </h1>
          <p className="text-sm text-gardens-txs mt-1">
            Jobs before payment — enquired, quoted and invoiced.
          </p>
        </div>
        <div className="flex items-center rounded-md border border-gardens-bdr p-0.5 bg-gardens-page/60">
          {(['active', 'exited'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'h-7 rounded px-3 text-xs font-medium capitalize transition-colors',
                view === v
                  ? 'bg-background text-gardens-tx shadow-sm'
                  : 'text-gardens-txs hover:text-gardens-tx',
              )}
            >
              {v === 'exited' && dueDormantCount > 0 ? `Exited (${dueDormantCount} due)` : v}
            </button>
          ))}
        </div>
      </div>

      {view === 'active' ? <PipelineBoard onExitJob={setExitingJob} /> : <ExitedJobsList />}

      <ExitJobModal job={exitingJob} onClose={() => setExitingJob(null)} />
    </div>
  );
}
