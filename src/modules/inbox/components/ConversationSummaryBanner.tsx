import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface ConversationSummaryBannerProps {
  summary: string | null;
  isLoading: boolean;
  error: Error | null;
  className?: string;
}

const boxClass =
  'flex w-full min-w-0 max-w-full flex-col gap-1.5 rounded-lg border border-gardens-grn/30 bg-gardens-grn/5 px-3 py-2.5';

const labelClass =
  'flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gardens-grn-dk';

function SummaryLabel() {
  return (
    <div className={labelClass}>
      <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>AI SUMMARY</span>
    </div>
  );
}

function ExpandableSummaryText({ text }: { text: string }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const measureOverflow = useCallback(() => {
    const el = textRef.current;
    if (!el || isExpanded) return;
    setHasOverflow(el.scrollHeight > el.clientHeight);
  }, [isExpanded]);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    measureOverflow();

    const observer = new ResizeObserver(() => measureOverflow());
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, measureOverflow, isExpanded]);

  const showToggle = hasOverflow || isExpanded;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <p
        ref={textRef}
        className={cn(
          'text-sm leading-relaxed text-gardens-tx min-w-0',
          !isExpanded && 'line-clamp-2 sm:line-clamp-3',
        )}
      >
        {text}
      </p>
      {showToggle && (
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="self-start inline-flex items-center gap-0.5 text-xs font-medium text-gardens-grn-dk hover:text-gardens-grn focus:outline-none focus:ring-2 focus:ring-gardens-grn/30 rounded"
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <>
              Show less
              <ChevronUp className="h-3 w-3" aria-hidden />
            </>
          ) : (
            <>
              Show more
              <ChevronDown className="h-3 w-3" aria-hidden />
            </>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Prominent AI summary callout for the conversation header.
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
        <SummaryLabel />
        <p className="text-sm text-gardens-txs">Summarising…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(boxClass, className)} role="status">
        <SummaryLabel />
        <p className="text-sm text-gardens-txs">Couldn&apos;t load summary</p>
      </div>
    );
  }

  if (!summary?.trim()) {
    return null;
  }

  return (
    <div className={cn(boxClass, className)}>
      <SummaryLabel />
      <ExpandableSummaryText text={summary.trim()} />
    </div>
  );
};
