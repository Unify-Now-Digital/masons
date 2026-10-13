import React from 'react';
import { Sparkles } from 'lucide-react';
import { NextStepBox, NextActionPill } from '@/shared/components/mason';
import type { NextAction } from '@/shared/lib/nextAction';

export interface ConversationNextStepBarProps {
  action: NextAction;
  /** Existing thread AI summary, shown as the reason's source line. */
  summary: string | null;
  summaryLoading?: boolean;
  primary: { label: string; onClick: () => void } | null;
}

/** inbox-v11 next-step bar, tied to the selected conversation (and its order). */
export const ConversationNextStepBar: React.FC<ConversationNextStepBarProps> = ({ action, summary, summaryLoading, primary }) => {
  const text = summary?.trim() || null;
  if (action.kind === 'none' && !text) return null;
  const shown: NextAction =
    action.kind === 'none' ? { kind: 'waiting', label: 'Nothing due', reason: 'Nothing due on this conversation', tone: 'neutral' } : action;
  return (
    <div className="shrink-0 px-3 pt-3" data-testid="next-step-bar">
      <NextStepBox
        action={shown}
        variant="joined"
        summary={
          text || summaryLoading ? (
            <span className="flex items-start gap-1.5">
              <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
              <span className="line-clamp-2">
                <b className="font-semibold">From the AI summary</b> · {summaryLoading && !text ? 'Summarising…' : text}
              </span>
            </span>
          ) : null
        }
      >
        <div className="flex items-center justify-between gap-2">
          {action.kind === 'waiting' ? <NextActionPill action={action} /> : <span />}
          {primary && (
            <button
              type="button"
              onClick={primary.onClick}
              className="h-9 px-4 rounded-lg bg-gardens-acc text-white text-[13px] font-semibold hover:opacity-90"
            >
              {primary.label}
            </button>
          )}
        </div>
      </NextStepBox>
    </div>
  );
};
