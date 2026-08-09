import React from 'react';

export interface ConversationHeaderProps {
  displayName: string;
  handleLine: string;
  subjectLine?: string | null;
  linkStateLabel: string;
  orderDisplayIdsText?: string | null;
  actionButtonLabel?: string;
  onActionClick?: () => void;
  secondaryActionButtonLabel?: string;
  onSecondaryActionClick?: () => void;
  tertiaryActionButtonLabel?: string;
  onTertiaryActionClick?: () => void;
  tertiaryActionTitle?: string;
  /** Chip next to the link-state label, e.g. "In pipeline: Quoted". */
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
  orderDisplayIdsText,
  actionButtonLabel,
  onActionClick,
  secondaryActionButtonLabel,
  onSecondaryActionClick,
  tertiaryActionButtonLabel,
  onTertiaryActionClick,
  tertiaryActionTitle,
  pipelineHintLabel,
  pipelineHintSlot,
  pipelineActionButtonLabel,
  onPipelineActionClick,
  summarySlot,
  scoreBadge,
}) => {
  const actions = (
    <>
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gardens-page text-gardens-tx border border-gardens-bdr shrink-0">
        {linkStateLabel}
      </span>
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
      {tertiaryActionButtonLabel != null && (
        <button
          type="button"
          onClick={onTertiaryActionClick}
          title={tertiaryActionTitle}
          className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg border border-gardens-bdr text-gardens-tx bg-white hover:bg-gardens-page focus:outline-none focus:ring-2 focus:ring-gardens-grn/30"
        >
          {tertiaryActionButtonLabel}
        </button>
      )}
      {secondaryActionButtonLabel != null && (
        <button
          type="button"
          onClick={onSecondaryActionClick}
          className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg border border-gardens-bdr text-gardens-tx bg-white hover:bg-gardens-page focus:outline-none focus:ring-2 focus:ring-gardens-grn/30"
        >
          {secondaryActionButtonLabel}
        </button>
      )}
      {actionButtonLabel != null && (
        <button
          type="button"
          onClick={onActionClick}
          className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg border border-gardens-bdr text-gardens-tx bg-white hover:bg-gardens-page focus:outline-none focus:ring-2 focus:ring-gardens-grn/30"
        >
          {actionButtonLabel}
        </button>
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
            <div className="flex shrink-0 gap-2 items-start sm:hidden">{actions}</div>
          </div>

          <div className="hidden sm:flex shrink-0 gap-2 items-center">{actions}</div>
        </div>

        {hasSummarySlot && <div className="min-w-0 w-full">{summarySlot}</div>}
      </div>
    </div>
  );
};
