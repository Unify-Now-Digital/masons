import { ChevronLeft, ChevronRight, DoorOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Pill, type PillTone } from '@/shared/components/gardens';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';
import type { JobInvoiceSummary, PipelineJob } from '../types/jobsPipeline.types';
import { formatAge, formatShortDate, getJobDisplayName, getJobEnquiryPrice } from '../utils/display';

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
}

const STATUS_TONES: Record<string, PillTone> = {
  uncontacted: 'amber',
  pending: 'neutral',
};

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
}: PipelineJobCardProps) {
  const navigate = useNavigate();
  const conversationId = job.conversation?.id ?? null;
  // Invoiced stage: the invoice total is the money fact and the enquiry price is
  // never consulted — a card shows one figure or "No price", never both.
  // `|| null`, not `?? null`: a zero invoice total is a data problem (see the
  // 26 Aug amount=0 incident), so it renders "No price" rather than £0.00.
  const price =
    job.stage === 'invoiced' ? invoiceSummary?.totalAmount || null : getJobEnquiryPrice(job);
  const priceLabel = price !== null ? formatGbpDecimal(price) : null;
  const age = formatAge(job.created_at);

  const openConversation = () => {
    if (conversationId) {
      navigate(`/dashboard/inbox?conversation=${encodeURIComponent(conversationId)}`);
    }
  };

  const actionButton =
    'inline-flex h-6 w-6 items-center justify-center rounded border border-gardens-bdr ' +
    'text-gardens-txs hover:bg-gardens-page hover:text-gardens-tx ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent';

  return (
    <div className="rounded-md border border-gardens-bdr bg-gardens-surf2 px-2.5 py-1.5 transition-colors hover:bg-gardens-page">
      <button
        type="button"
        onClick={openConversation}
        disabled={!conversationId}
        className={cn('w-full text-left', !conversationId && 'cursor-default')}
        title={conversationId ? 'Open conversation in Inbox' : 'No linked conversation'}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium text-gardens-tx leading-snug min-w-0 truncate">
            {getJobDisplayName(job)}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {warningLabel ? <Pill tone="amber">{warningLabel}</Pill> : null}
            {job.stage_status ? (
              <Pill tone={STATUS_TONES[job.stage_status] ?? 'neutral'}>{job.stage_status}</Pill>
            ) : null}
          </div>
        </div>
        <div className="mt-1 text-[11px] text-gardens-txs">
          {formatShortDate(job.created_at)}
          <span className="text-gardens-txm"> · {age}</span>
        </div>
        <div className={cn('text-[11px]', priceLabel ? 'text-gardens-txm' : 'text-gardens-txs')}>
          {priceLabel ?? 'No price'}
        </div>
      </button>

      <div className="mt-1 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          {onMoveBack ? (
            <button
              type="button"
              className={actionButton}
              onClick={onMoveBack}
              disabled={isMoving}
              title="Move back"
              aria-label="Move back"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onMoveForward ? (
            <span title={moveForwardDisabled ? moveForwardDisabledReason : undefined}>
              <button
                type="button"
                className={actionButton}
                onClick={onMoveForward}
                disabled={moveForwardDisabled || isMoving}
                title={moveForwardDisabled ? moveForwardDisabledReason : 'Move forward'}
                aria-label="Move forward"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : null}
        </div>
        {onExit ? (
          <button
            type="button"
            className={actionButton}
            onClick={onExit}
            disabled={isMoving}
            title="Exit pipeline"
            aria-label="Exit pipeline"
          >
            <DoorOpen className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
