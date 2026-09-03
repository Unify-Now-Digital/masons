import React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

/** One entry in the header's Actions menu (C7). */
export interface ConversationHeaderAction {
  /** Stable identity: React key, and a handle for future e2e selectors. */
  id: string;
  label: string;
  onSelect: () => void;
  /** Native tooltip. Hide/Unmute carries a distinct string per state. */
  title?: string;
}

export interface ConversationHeaderProps {
  displayName: string;
  handleLine: string;
  subjectLine?: string | null;
  linkStateLabel: string;
  /**
   * Green pairing for the settled 'Linked' state; anything else keeps the
   * neutral pairing. Passed explicitly rather than sniffed off linkStateLabel —
   * the two views deliberately use different unlinked wording.
   */
  linkStateTone?: 'linked' | 'neutral';
  orderDisplayIdsText?: string | null;
  /**
   * Contact-record actions, in display order. One item renders a plain button
   * (collapsing a lone action into a menu would cost a click on the commonest
   * state); 2+ render the Actions menu; none renders nothing.
   */
  actions?: ConversationHeaderAction[];
  /** Chip in the pipeline cluster, e.g. "In pipeline: Quoted". */
  pipelineHintLabel?: string | null;
  /** When set, renders in place of the pipelineHintLabel chip (e.g. multi-job picker). */
  pipelineHintSlot?: React.ReactNode;
  pipelineActionButtonLabel?: string;
  onPipelineActionClick?: () => void;
  /** Optional compact AI summary — inline between identity block and link/actions on larger screens. */
  summarySlot?: React.ReactNode;
  /** Optional customer score badge rendered next to the display name. */
  scoreBadge?: React.ReactNode;
}

/** Conversation header. Custom styling only (no shadcn Avatar/Button). */
export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  displayName,
  handleLine,
  subjectLine = null,
  linkStateLabel,
  linkStateTone = 'neutral',
  orderDisplayIdsText,
  actions,
  pipelineHintLabel,
  pipelineHintSlot,
  pipelineActionButtonLabel,
  onPipelineActionClick,
  summarySlot,
  scoreBadge,
}) => {
  // Contact-status pill, now in the identity block beside the name (C7).
  // An empty label renders NOTHING, not an empty bordered box.
  const linkStatePill = linkStateLabel.trim() ? (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border shrink-0',
        linkStateTone === 'linked'
          ? 'bg-gardens-grn-lt border-gardens-grn text-gardens-grn-dk'
          : 'bg-gardens-page border-gardens-bdr text-gardens-tx',
      )}
    >
      {linkStateLabel}
    </span>
  ) : null;

  const actionItems = actions ?? [];
  const soleAction = actionItems.length === 1 ? actionItems[0] : null;

  // Job axis (pill + its own button) stays a button set; the contact-record
  // actions collapse into one menu at 2+, and stay a plain button at 1.
  // This cluster renders TWICE — the sm:hidden cell inside the identity row and
  // the sm+ cell beside it. That duplication is PRE-EXISTING (the button set did
  // the same); the dropdown does not introduce it. Only the visible cell's
  // control is reachable.
  const actionsCluster = (
    <>
      {pipelineHintSlot != null ? (
        pipelineHintSlot
      ) : pipelineHintLabel ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gardens-page text-gardens-tx border border-gardens-bdr shrink-0">
          {pipelineHintLabel}
        </span>
      ) : null}
      {pipelineActionButtonLabel != null && (
        <button
          type="button"
          onClick={onPipelineActionClick}
          className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg border border-gardens-bdr text-gardens-tx bg-white hover:bg-gardens-page focus:outline-none focus:ring-2 focus:ring-gardens-grn/30"
        >
          {pipelineActionButtonLabel}
        </button>
      )}
      {soleAction != null && (
        <button
          type="button"
          onClick={soleAction.onSelect}
          title={soleAction.title}
          className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg border border-gardens-bdr text-gardens-tx bg-white hover:bg-gardens-page focus:outline-none focus:ring-2 focus:ring-gardens-grn/30"
        >
          {soleAction.label}
        </button>
      )}
      {actionItems.length > 1 && (
        // DropdownMenu per the in-module JobPicker / C5a precedent. No asChild:
        // no function-valued className crosses a Radix trigger.
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Actions"
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gardens-bdr text-gardens-tx bg-white hover:bg-gardens-page focus:outline-none focus:ring-2 focus:ring-gardens-grn/30"
          >
            Actions
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actionItems.map((action) => (
              <DropdownMenuItem
                key={action.id}
                title={action.title}
                onSelect={action.onSelect}
              >
                <span className="text-[12px]">{action.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );

  const hasSummarySlot = summarySlot != null && summarySlot !== false;

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gardens-bdr shrink-0 px-4 py-3 min-w-0">
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:items-start sm:gap-3">
          {/* Identity + actions on one row (mobile); on sm+ identity only in this cell */}
          <div className="flex min-w-0 flex-1 basis-0 flex-row items-start justify-between gap-2 sm:block sm:justify-start">
            <div className="min-w-0 flex-1 sm:flex-none">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-semibold text-gardens-tx truncate">
                  {displayName}
                </span>
                {scoreBadge}
                {linkStatePill}
                {orderDisplayIdsText && (
                  <span className="text-[11px] font-mono text-gardens-txs truncate min-w-0">
                    {orderDisplayIdsText}
                  </span>
                )}
              </div>
              <p className="text-sm text-gardens-txs truncate mt-0.5">{handleLine}</p>
              {subjectLine && (
                <p className="text-[12px] text-gardens-tx truncate mt-0.5">
                  {subjectLine}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2 items-start sm:hidden">{actionsCluster}</div>
          </div>

          <div className="hidden sm:flex shrink-0 gap-2 items-center">{actionsCluster}</div>
        </div>

        {hasSummarySlot && <div className="min-w-0 w-full">{summarySlot}</div>}
      </div>
    </div>
  );
};
