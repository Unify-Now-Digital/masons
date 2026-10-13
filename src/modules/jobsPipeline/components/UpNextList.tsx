import { AlertTriangle, Hourglass, ListChecks } from 'lucide-react';
import { NextActionPill } from '@/shared/components/mason';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';
import type { JobInvoiceSummary, PipelineJob } from '../types/jobsPipeline.types';
import { formatStageLabel, getJobDisplayName } from '../utils/display';
import { jobNextStep, jobValue, jobValueLabel, quietText, upNext } from '../utils/pipelineView';

interface UpNextListProps {
  jobs: PipelineJob[];
  invoiceSummaries: Map<string, JobInvoiceSummary>;
  selectedJobId?: string | null;
  onSelectJob?: (jobId: string) => void;
}

const GROUP_LABEL = { quiet: 'Gone quiet: chase', open: 'Open, not yet due' } as const;

/** pipeline-v1 "Up next" focus list: count cue, then gone-quiet first, by value. */
export function UpNextList({ jobs, invoiceSummaries, selectedJobId, onSelectJob }: UpNextListProps) {
  const groups = upNext(jobs, invoiceSummaries);
  const quietCount = groups.find((g) => g.group === 'quiet')?.jobs.length ?? 0;
  return (
    <aside className="flex flex-col min-h-0 rounded-[10px] border border-gardens-bdr bg-gardens-surf overflow-hidden" aria-label="Up next">
      <div className="px-3 py-2.5 border-b border-gardens-bdr" data-testid="pipeline-cue">
        <div className="font-head text-[18px] font-semibold text-gardens-tx">
          {quietCount} need{quietCount === 1 ? 's' : ''} you now
        </div>
        <div className="text-[12px] text-gardens-txs">
          <b className={cn(quietCount > 0 && 'text-gardens-sem-red')}>{quietCount} gone quiet</b> · {jobs.length - quietCount} on track
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {groups.map((g) => (
          <section key={g.group}>
            <h3 className="sticky top-0 bg-gardens-page px-3 py-1.5 m-0 text-[11px] font-extrabold uppercase tracking-[0.08em] text-gardens-txs flex items-center gap-1.5">
              {g.group === 'quiet' ? <Hourglass className="h-3 w-3" aria-hidden /> : <ListChecks className="h-3 w-3" aria-hidden />}
              {GROUP_LABEL[g.group]} <span className="font-semibold">{g.jobs.length}</span>
            </h3>
            {g.jobs.map((job) => {
              const inv = invoiceSummaries.get(job.id);
              const v = jobValue(job, inv);
              const t = quietText(job);
              const selected = selectedJobId === job.id;
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => onSelectJob?.(job.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 border-b border-gardens-bdr border-l-[3px] flex flex-col gap-1',
                    selected ? 'bg-gardens-acc-lt border-l-gardens-acc' : 'border-l-transparent hover:bg-gardens-page',
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-head text-[14px] font-semibold text-gardens-tx truncate">{getJobDisplayName(job)}</span>
                    <span className="text-[11px] text-gardens-txm-aa shrink-0">{formatStageLabel(job.stage)}</span>
                    <span className={cn('ml-auto shrink-0 inline-flex items-center gap-1 text-[12px]', t.tone === 'over' ? 'text-gardens-sem-red font-semibold' : 'text-gardens-txm-aa')}>
                      {t.tone === 'over' && <AlertTriangle className="h-3 w-3" aria-hidden />}
                      {t.text}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[12px] text-gardens-txs truncate flex-1">
                      {v != null ? formatGbpDecimal(v) : jobValueLabel(job, inv)}
                    </span>
                    <NextActionPill action={jobNextStep(job, inv)} solid={selected} />
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </aside>
  );
}
