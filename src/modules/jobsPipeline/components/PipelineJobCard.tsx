import { AlertTriangle, ChevronLeft, ChevronRight, DoorOpen, FileText, Mail } from 'lucide-react';
import { useOpenPerson } from '@/shared/context/PersonPanelContext';
import { Pill } from '@/shared/components/gardens';
import { NextActionPill } from '@/shared/components/mason';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';
import type { JobInvoiceSummary, PipelineJob } from '../types/jobsPipeline.types';
import { getJobDisplayName } from '../utils/display';
import { isGoneQuiet, jobNextStep, jobValue, jobValueLabel, quietText, shouldFlagMoveToInvoiced } from '../utils/pipelineView';

interface PipelineJobCardProps {
  job: PipelineJob;
  invoiceSummary?: JobInvoiceSummary;
  /** Data-problem indicator (e.g. post-paid stage with no paid_at) — amber pill. */
  warningLabel?: string;
  onMoveBack?: () => void;
  onMoveForward?: () => void;
  moveForwardDisabled?: boolean;
  moveForwardDisabledReason?: string;
  onExit?: () => void;
  isMoving?: boolean;
  selected?: boolean;
}

/** pipeline-v1 card: name · value (or honest text) · timer in words · one next step. */
export function PipelineJobCard({
  job,
  invoiceSummary,
  warningLabel,
  onMoveBack,
  onMoveForward,
  moveForwardDisabled,
  moveForwardDisabledReason,
  onExit,
  isMoving,
  selected,
}: PipelineJobCardProps) {
  const openPerson = useOpenPerson();
  const conversationId = job.conversation?.id ?? null;
  const value = jobValue(job, invoiceSummary);
  const honest = jobValueLabel(job, invoiceSummary);
  const quiet = isGoneQuiet(job);
  const timer = quietText(job);
  const next = jobNextStep(job, invoiceSummary);
  const flagMove = shouldFlagMoveToInvoiced(job, invoiceSummary);
  const estimate = value != null && job.stage === 'enquired';

  const openConversation = () => {
    openPerson({ personId: job.person_id, conversationId, name: getJobDisplayName(job) });
  };

  const quick =
    'inline-flex h-6 w-6 items-center justify-center rounded border border-gardens-bdr bg-white ' +
    'text-gardens-txs hover:bg-gardens-page hover:text-gardens-tx ' +
    'disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div
      data-testid="pipeline-card"
      data-quiet={quiet || undefined}
      className={cn(
        'group relative rounded-lg border bg-white px-2.5 py-2 transition-colors',
        quiet ? 'border-l-[3px] border-l-gardens-sem-red border-gardens-bdr' : 'border-gardens-bdr',
        selected && 'bg-gardens-acc-lt border-gardens-acc',
      )}
    >
      <button
        type="button"
        onClick={openConversation}
        disabled={!conversationId && !job.person_id}
        className={cn('w-full text-left', !conversationId && 'cursor-default')}
        title="Open in the side panel"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="font-head text-[14px] font-semibold text-gardens-tx leading-snug min-w-0 truncate">
            {getJobDisplayName(job)}
          </div>
          {warningLabel ? <Pill tone="amber">{warningLabel}</Pill> : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-[12px]">
          <span className={cn('truncate', value != null ? 'font-semibold text-gardens-tx tabular-nums' : 'text-gardens-txs')}>
            {value != null ? `${formatGbpDecimal(value)}${estimate ? ' est.' : ''}` : honest}
          </span>
          <span
            className={cn(
              'shrink-0 inline-flex items-center gap-1 whitespace-nowrap',
              timer.tone === 'over' ? 'text-gardens-sem-red font-semibold' : 'text-gardens-txm-aa',
            )}
          >
            {timer.tone === 'over' && <AlertTriangle className="h-3 w-3" aria-hidden />}
            {timer.text}
          </span>
        </div>
      </button>
      {flagMove && (
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-gardens-txs">
            <FileText className="h-3 w-3" aria-hidden /> Invoice sent
          </span>
          {onMoveForward && !moveForwardDisabled ? (
            <button type="button" onClick={onMoveForward} disabled={isMoving} className="underline text-gardens-sem-amber font-semibold">
              Move to Invoiced
            </button>
          ) : null}
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {conversationId ? (
            <button type="button" className={quick} onClick={openConversation} title="Email / open conversation" aria-label="Open conversation">
              <Mail className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onMoveBack ? (
            <button type="button" className={quick} onClick={onMoveBack} disabled={isMoving} title="Move back" aria-label="Move back">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onMoveForward ? (
            <span title={moveForwardDisabled ? moveForwardDisabledReason : undefined}>
              <button
                type="button"
                className={quick}
                onClick={onMoveForward}
                disabled={moveForwardDisabled || isMoving}
                title={moveForwardDisabled ? moveForwardDisabledReason : 'Move forward'}
                aria-label="Move forward"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : null}
          {onExit ? (
            <button type="button" className={quick} onClick={onExit} disabled={isMoving} title="Exit pipeline" aria-label="Exit pipeline">
              <DoorOpen className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {next.kind !== 'none' ? <NextActionPill action={next} solid={selected} /> : null}
      </div>
    </div>
  );
}
