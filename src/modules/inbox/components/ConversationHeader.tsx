import React, { useState } from 'react';
import { Link2, MoreHorizontal, Plus, User, Columns3, Check, EyeOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { cn } from '@/shared/lib/utils';
import { newJobConfirmCopy, type OpenJobRef } from '@/shared/lib/orderPanel';
import { LEAD_SOURCES } from '@/shared/lib/leadSource';

/** One entry in the header's ⋯ menu. */
export interface ConversationHeaderAction {
  /** Stable identity: React key, and a handle for e2e selectors. */
  id: string;
  label: string;
  onSelect: () => void;
  /** Native tooltip. Hide/Unmute carries a distinct string per state. */
  title?: string;
  /** Second, quieter line in the menu (e.g. "Linked to … · ORD-000280"). */
  hint?: string | null;
  /** Shows a check mark (display state, e.g. "Show all channels"). */
  checked?: boolean;
  /** Draw a separator above this item. */
  separatorBefore?: boolean;
}

export interface ConversationHeaderProps {
  displayName: string;
  /** Fallback quiet line when no statusLine is given (channel · handle). */
  handleLine: string;
  /** inbox-v11: ONE quiet status beside the name, e.g. "Invoice sent, deposit not paid". */
  statusLine?: string | null;
  subjectLine?: string | null;
  /** Only the unlinked state gets a visible flag (linked is the normal state). */
  linkStateLabel: string;
  linkStateTone?: 'linked' | 'neutral';
  /** Kept for API compatibility; no longer rendered (v11 noise cut). */
  orderDisplayIdsText?: string | null;
  /** Contact-record actions, in display order — all live in the ⋯ menu. */
  actions?: ConversationHeaderAction[];
  /** Kept for API compatibility; the stage now shows in the menu ("Open in Pipeline"). */
  pipelineHintLabel?: string | null;
  /** Multi-job picker (2+ jobs) — still inline, it changes what the panel shows. */
  pipelineHintSlot?: React.ReactNode;
  /** "New job" / "Add to pipeline" / "Adding…" — rendered as a menu item. */
  pipelineActionButtonLabel?: string;
  /** Called with the lead source picked in the add dialog ('' = not recorded). */
  onPipelineActionClick?: (leadSource: string) => void;
  /** Pre-selected lead source in the add dialog. */
  defaultLeadSource?: string;
  /** When set, the pipeline action asks first (duplicate check). */
  pipelineConfirm?: { title: string; body: string; confirmLabel?: string } | null;
  /** Alternative to pipelineConfirm: the header builds the duplicate-check copy. */
  duplicateCheck?: { firstName: string; openJobs: OpenJobRef[] } | null;
  /** Extra menu items after the pipeline action (Show all channels, Open in Pipeline, Customer details). */
  menuExtras?: ConversationHeaderAction[];
  /** Rendered below the header row (legacy summary banner for views without a next-step bar). */
  summarySlot?: React.ReactNode;
  /**
   * Phone thread: one row (Back, name, Order, menu). Subject and the AI summary
   * sit in a disclosure that starts closed.
   */
  compact?: boolean;
  leading?: React.ReactNode;
  orderSlot?: React.ReactNode;
  /** Kept for API compatibility; v11 drops the score badge from the header. */
  scoreBadge?: React.ReactNode;
}

export interface ThreadHeaderChrome {
  leading?: React.ReactNode;
  orderSlot?: React.ReactNode;
}

/** Back (and Order) while the thread header itself is not on screen yet. */
export function ThreadChromeBar({ leading, orderSlot, title }: { leading?: React.ReactNode; orderSlot?: React.ReactNode; title?: string }) {
  if (!leading && !orderSlot) return null;
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1.5 border-b border-gardens-bdr bg-white px-2 py-1">
      {leading}
      {title ? (
        <h2 className="m-0 min-w-0 flex-1 truncate font-head text-[15px] font-semibold leading-5 text-gardens-tx">{title}</h2>
      ) : (
        <span className="flex-1" />
      )}
      {orderSlot}
    </div>
  );
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  link: Link2,
  'link-person': Link2,
  pipeline: Plus,
  channels: Check,
  'open-pipeline': Columns3,
  customer: User,
  mute: EyeOff,
};

/** inbox-v11 conversation header: name + one quiet status + ⋯ menu. */
export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  displayName,
  handleLine,
  statusLine,
  subjectLine = null,
  linkStateLabel,
  linkStateTone = 'neutral',
  actions,
  pipelineHintSlot,
  pipelineActionButtonLabel,
  onPipelineActionClick,
  defaultLeadSource,
  pipelineConfirm: pipelineConfirmProp,
  duplicateCheck,
  menuExtras,
  summarySlot,
  compact = false,
  leading,
  orderSlot,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leadSource, setLeadSource] = useState('');
  // Every add goes through the dialog so the lead source is recorded (15 Oct 2026).
  const pipelineConfirm: { title: string; body: string; confirmLabel?: string } =
    pipelineConfirmProp ??
    (duplicateCheck
      ? newJobConfirmCopy(duplicateCheck.firstName, duplicateCheck.openJobs)
      : { title: 'Add to pipeline', body: 'Creates a job at Enquired.', confirmLabel: 'Add to pipeline' });

  const pipelineItem: ConversationHeaderAction | null =
    pipelineActionButtonLabel != null && onPipelineActionClick
      ? {
          id: 'pipeline',
          label: `${pipelineActionButtonLabel}…`,
          hint: 'Asks where the enquiry came from',
          onSelect: () => {
            setLeadSource(defaultLeadSource ?? '');
            setConfirmOpen(true);
          },
        }
      : null;

  const items: ConversationHeaderAction[] = [
    ...(actions ?? []),
    ...(pipelineItem ? [pipelineItem] : []),
    ...(menuExtras ?? []),
  ];

  const showUnlinkedFlag = linkStateTone !== 'linked' && linkStateLabel.trim() !== '';
  const quiet = statusLine ?? handleLine;

  const collapsedExtras = compact && (subjectLine || summarySlot || showUnlinkedFlag || pipelineHintSlot);

  return (
    <div className={cn('sticky top-0 z-10 bg-white border-b border-gardens-bdr shrink-0 min-w-0', compact ? 'px-2 py-1' : 'px-4 py-2.5')}>
      <div className={cn('flex min-w-0 items-center', compact ? 'gap-1.5' : 'flex-wrap gap-2')}>
        {compact && leading}
        <div className={cn('flex min-w-0 flex-1', compact ? 'items-center' : 'basis-48 flex-wrap items-baseline gap-x-2.5 gap-y-1')}>
          <h2
            className={cn(
              'm-0 min-w-0 font-head font-semibold text-gardens-tx',
              compact ? 'truncate text-[15px] leading-5' : 'text-[20px] leading-6 line-clamp-2',
            )}
            title={compact ? (quiet || displayName) : undefined}
            data-testid="conversation-title"
          >
            {displayName}
          </h2>
          {!compact && showUnlinkedFlag && (
            <span className="inline-flex shrink-0 items-center rounded-md border border-gardens-bdr bg-gardens-page px-2 py-0.5 text-[11px] font-medium text-gardens-tx">
              {linkStateLabel}
            </span>
          )}
          {!compact && quiet && <span className="min-w-0 text-[13px] leading-5 text-gardens-txs line-clamp-2" data-testid="conversation-status">· {quiet}</span>}
        </div>
        {!compact && pipelineHintSlot}
        {compact && orderSlot}
        {items.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Conversation actions"
              className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-lg border border-gardens-bdr bg-white text-gardens-tx hover:bg-gardens-page focus:outline-none focus:ring-2 focus:ring-gardens-acc/30',
                compact ? 'h-8 w-8' : 'h-11 w-11 lg:h-8 lg:w-8',
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {items.map((item) => {
                const Icon = ICONS[item.id];
                return (
                  <React.Fragment key={item.id}>
                    {item.separatorBefore && <DropdownMenuSeparator />}
                    <DropdownMenuItem title={item.title} onSelect={item.onSelect} className="items-start gap-2" data-testid={`header-action-${item.id}`}>
                      {Icon && item.id !== 'channels' ? <Icon className="h-4 w-4 mt-0.5 shrink-0 text-gardens-txs" /> : <span className="w-4" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] text-gardens-tx">{item.label}</span>
                        {item.hint && <span className="block text-[11px] leading-4 text-gardens-txm-aa line-clamp-2">{item.hint}</span>}
                      </span>
                      {item.checked && <Check className="h-4 w-4 mt-0.5 shrink-0 text-gardens-tx" aria-label="On" />}
                    </DropdownMenuItem>
                  </React.Fragment>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {!compact && subjectLine && <p className={cn('mt-0.5 whitespace-normal break-words text-[12px] leading-5 text-gardens-tx line-clamp-2')}>{subjectLine}</p>}
      {!compact && summarySlot != null && summarySlot !== false && <div className="min-w-0 w-full mt-2">{summarySlot}</div>}
      {collapsedExtras && (
        <details className="mt-0.5 min-w-0" data-testid="thread-summary-disclosure">
          <summary className="cursor-pointer list-none py-0.5 text-[12px] font-medium text-gardens-txs [&::-webkit-details-marker]:hidden">
            {summarySlot ? 'AI summary' : 'Details'}
          </summary>
          <div className="min-w-0 space-y-1 pb-1">
            {showUnlinkedFlag && (
              <span className="inline-flex items-center rounded-md border border-gardens-bdr bg-gardens-page px-2 py-0.5 text-[11px] font-medium text-gardens-tx">
                {linkStateLabel}
              </span>
            )}
            {quiet && <p className="m-0 text-[12px] leading-5 text-gardens-txs" data-testid="conversation-status">{quiet}</p>}
            {subjectLine && <p className="m-0 whitespace-normal break-words text-[12px] leading-5 text-gardens-tx line-clamp-2">{subjectLine}</p>}
            {pipelineHintSlot}
            {summarySlot != null && summarySlot !== false && <div className="min-w-0 w-full">{summarySlot}</div>}
          </div>
        </details>
      )}

      {(
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-head">{pipelineConfirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{pipelineConfirm.body}</AlertDialogDescription>
            </AlertDialogHeader>
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="font-medium">Source</span>
              <select
                data-testid="lead-source-select"
                className="h-9 rounded-md border border-gardens-bdr bg-white px-2 text-[13px]"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
              >
                <option value="">Not sure</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                data-testid="confirm-new-job"
                onClick={() => {
                  setConfirmOpen(false);
                  onPipelineActionClick?.(leadSource);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                {pipelineConfirm.confirmLabel ?? 'Start new job'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};
