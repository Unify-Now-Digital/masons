import React from 'react';
import { Sparkles } from 'lucide-react';
import { ActionChip, NextActionPill } from '@/shared/components/mason';
import type { NextAction } from '@/shared/lib/nextAction';

export interface ConversationNextStepBarProps {
  action: NextAction;
  /** Existing thread AI summary, used as the one-line suggestion. */
  summary: string | null;
  summaryLoading?: boolean;
  primary: { label: string; onClick: () => void } | null;
  /** Reply timer tone; 'over' makes the pill red (act now). */
  overdue?: boolean;
}

/**
 * Shell v2 conversation next action: ONE pill (universal language, src/shared/nextAction.ts)
 * + a one-line suggestion. The prepared reply itself is pre-filled in the composer
 * (ConversationThread `prefillSuggestedReply`) — never sent automatically.
 * Nothing due → renders nothing (the old "NEXT STEP / Nothing due" box is gone).
 */
export const ConversationNextStepBar: React.FC<ConversationNextStepBarProps> = ({ action, summary, summaryLoading, primary, overdue }) => {
  if (action.kind === 'none') return null;
  const text = summary?.trim() || null;
  const suggestion = text ?? (summaryLoading ? 'Summarising…' : action.reason || null);
  return (
    <div className="flex min-h-8 shrink-0 flex-wrap items-center gap-2 border-b border-gardens-bdr/60 px-3 py-1.5" data-testid="next-step-bar">
      {action.kind === 'waiting' ? (
        <NextActionPill action={action} className="shrink-0 h-[24px]" />
      ) : (
        <ActionChip
          kind={action.kind}
          label={primary?.label ?? action.label}
          tone={overdue ? 'red' : action.tone}
          expanded
          solid
          className="shrink-0 h-[24px]"
          onClick={() => primary?.onClick()}
        />
      )}
      {suggestion && (
        <p className="m-0 min-w-0 flex-1 basis-40 text-[13px] leading-5 text-gardens-txs line-clamp-2" title={suggestion} data-testid="next-step-suggestion">
          {text && <Sparkles className="inline h-3.5 w-3.5 mr-1 -mt-0.5" aria-hidden />}
          {suggestion}
        </p>
      )}
    </div>
  );
};
