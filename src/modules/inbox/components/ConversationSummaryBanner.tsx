import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface ConversationSummaryBannerProps {
  summary: string | null;
  isLoading: boolean;
  error: Error | null;
  className?: string;
}

const boxClass =
  'flex w-full min-w-0 max-w-full items-start gap-1.5 rounded-md border border-gardens-bdr bg-gardens-page/90 px-2 py-1.5 shadow-sm';

/**
 * Compact AI insight for the conversation header (Sparkles + short text).
 * Renders nothing when idle with no summary (empty thread or null response).
 */
export const ConversationSummaryBanner: React.FC<ConversationSummaryBannerProps> = ({
  summary,
  isLoading,
  error,
  className,
}) => {
  if (isLoading) {
    return (
      <div className={cn(boxClass, className)} role="status" aria-live="polite">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-gardens-grn-dk mt-0.5" aria-hidden />
        <p className="text-[11px] leading-snug text-gardens-txs">Summarising…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(boxClass, className)} role="status">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-gardens-txs mt-0.5" aria-hidden />
        <p className="text-[11px] leading-snug text-gardens-txs">Couldn&apos;t load summary</p>
      </div>
    );
  }

  if (!summary?.trim()) {
    return null;
  }

  return (
    <div className={cn(boxClass, className)}>
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-gardens-grn-dk mt-0.5" aria-hidden />
      <p
        className="text-[11px] leading-snug text-gardens-tx line-clamp-2 sm:line-clamp-3 min-w-0"
        title={summary.trim()}
      >
        {summary.trim()}
      </p>
    </div>
  );
};
