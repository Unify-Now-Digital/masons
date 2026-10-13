import { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { columnSummary, type PipelineFilter } from '../utils/pipelineView';
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
  const [filter, setFilter] = useState<PipelineFilter>('all');
  const [source, setSource] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

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

  const { openValue, weighted, sources } = useMemo(() => {
    let open = 0, w = 0;
    const src = new Set<string>();
    for (const stage of BEFORE_PAID_STAGES) {
      const sum = columnSummary(stage, beforePipeline.columns[stage], beforePipeline.invoiceSummaries);
      open += sum.total;
      w += sum.weighted;
      for (const j of beforePipeline.columns[stage]) src.add(j.source);
    }
    return { openValue: open, weighted: w, sources: [...src].sort() };
  }, [beforePipeline.columns, beforePipeline.invoiceSummaries]);

  const tabs: { value: PipelineView; label: string }[] = [
    {
      value: 'before',
      label: beforePipeline.isLoading ? 'Before payment' : `Before payment ${beforeTotal}`,
    },
    {
      value: 'after',
      label: afterPipeline.isLoading ? 'After payment' : `After payment ${afterTotal}`,
    },
    {
      value: 'exited',
      label: dueDormantCount > 0 ? `Exited (${dueDormantCount} due)` : 'Exited',
    },
  ];

  return (
    <div className="space-y-4 min-w-0 lg:flex lg:flex-col lg:h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-head text-xl sm:text-2xl font-semibold text-gardens-tx tracking-tight m-0">Pipeline</h1>
          <div className="flex items-center gap-1" role="tablist" aria-label="Pipeline view">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={view === tab.value}
                onClick={() => setView(tab.value)}
                className={cn(
                  'h-7 rounded-full px-3 text-xs font-semibold border transition-colors',
                  view === tab.value
                    ? 'bg-gardens-tx text-white border-gardens-tx'
                    : 'bg-white text-gardens-tx border-gardens-bdr hover:bg-gardens-page',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'before' && (
        <div className="flex flex-wrap items-center justify-between gap-2" data-testid="pipeline-filters">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-gardens-txs" aria-hidden />
            {([
              ['all', 'Everything'],
              ['quiet', 'Gone quiet'],
              ['not_quiet', 'On track'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  'h-7 rounded-full px-3 text-xs font-medium border',
                  filter === value ? 'bg-gardens-acc-lt border-gardens-acc text-gardens-tx' : 'bg-white border-gardens-bdr text-gardens-tx hover:bg-gardens-page',
                )}
              >
                {label}
              </button>
            ))}
            <select
              aria-label="Source"
              value={source ?? ''}
              onChange={(e) => setSource(e.target.value || null)}
              className="h-7 rounded-full px-2 text-xs border border-gardens-bdr bg-white text-gardens-tx"
            >
              <option value="">Source: all</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  Source: {s}
                </option>
              ))}
            </select>
          </div>
          <div className="text-[12px] text-gardens-txs">
            Open value <b className="text-gardens-tx tabular-nums">{formatGbpDecimal(openValue)}</b>
            <span className="mx-2">·</span>
            Weighted <b className="text-gardens-tx tabular-nums">{formatGbpDecimal(weighted)}</b>*
          </div>
        </div>
      )}

      {view === 'before' ? (
        <PipelineBoard
          onExitJob={setExitingJob}
          filter={filter}
          source={source}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
        />
      ) : view === 'after' ? (
        <AfterPaidBoard onExitJob={setExitingJob} />
      ) : (
        <ExitedJobsList />
      )}

      {view === 'before' && (
        <p className="text-[11px] text-gardens-txm-aa m-0">
          * Weighted value uses assumed stage odds (Enquired 10%, Quoted 40%, Invoiced 80%). Quiet = days since the job last changed.
        </p>
      )}
      <ExitJobModal job={exitingJob} onClose={() => setExitingJob(null)} />
    </div>
  );
}
