import React from 'react';
import { MessageCircleReply, FilePlus2, PoundSterling, Clock } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { NextAction, NextActionKind } from '@/shared/lib/nextAction';

type PillKind = Exclude<NextActionKind, 'waiting' | 'none'>;

/** v7 action palette: teal / berry / ink / olive / plum. Icon + label carry the meaning; colour backs it up. */
const KIND_STYLE: Record<PillKind, { tint: string; solid: string; icon: React.ComponentType<{ className?: string }> }> = {
  follow: { tint: 'text-gardens-act-follow bg-gardens-act-follow-lt', solid: 'bg-gardens-act-follow text-white', icon: MessageCircleReply },
  order: { tint: 'text-gardens-act-order bg-gardens-act-order-lt', solid: 'bg-gardens-act-order text-white', icon: FilePlus2 },
  deposit: { tint: 'text-gardens-act-balance bg-gardens-act-balance-lt', solid: 'bg-gardens-act-balance text-white', icon: PoundSterling },
  balance: { tint: 'text-gardens-act-balance bg-gardens-act-balance-lt', solid: 'bg-gardens-act-balance text-white', icon: PoundSterling },
};

export interface ActionPillProps {
  kind: PillKind;
  label: string;
  /** Solid only on the selected row (audit #3); tinted everywhere else. */
  solid?: boolean;
  className?: string;
}

/** Read-only action pill (a label, not a button: rows stay one control). */
export const ActionPill: React.FC<ActionPillProps> = ({ kind, label, solid, className }) => {
  const s = KIND_STYLE[kind];
  const Icon = s.icon;
  return (
    <span
      data-kind={kind}
      className={cn(
        'inline-flex items-center gap-1 h-[26px] pl-2 pr-3 rounded-full text-xs font-bold whitespace-nowrap',
        solid ? s.solid : s.tint,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
};

/** Grey Waiting chip — never a button (both screens). */
export const WaitingChip: React.FC<{ label: string; className?: string }> = ({ label, className }) => (
  <span
    data-kind="waiting"
    className={cn(
      'inline-flex items-center gap-1 h-[26px] pl-2 pr-3 rounded-full text-xs font-semibold whitespace-nowrap',
      'bg-gardens-sem-grey-lt text-gardens-txs border border-gardens-bdr',
      className,
    )}
  >
    <Clock className="h-3.5 w-3.5" aria-hidden />
    {label}
  </span>
);

/** Pill for any NextAction: action pill, Waiting chip, or nothing. */
export const NextActionPill: React.FC<{ action: NextAction; solid?: boolean; className?: string }> = ({ action, solid, className }) => {
  if (action.kind === 'none') return null;
  if (action.kind === 'waiting') return <WaitingChip label={action.label} className={className} />;
  return <ActionPill kind={action.kind} label={action.label} solid={solid} className={className} />;
};

export interface ActionChipProps extends ActionPillProps {
  /** Full label (selected row) vs a compact icon chip with the label as tooltip. */
  expanded?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Clickable action chip (inbox rows, 2026-10-14): compact icon chip on ordinary rows,
 * the full labelled action on the selected row. Rendered OUTSIDE the row button.
 */
export const ActionChip: React.FC<ActionChipProps> = ({ kind, label, solid, expanded, className, onClick }) => {
  const s = KIND_STYLE[kind];
  const Icon = s.icon;
  return (
    <button
      type="button"
      data-kind={kind}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-full text-xs font-bold whitespace-nowrap',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc/40 hover:brightness-95',
        expanded ? 'h-[26px] pl-2 pr-3' : 'h-[22px] w-[22px]',
        solid ? s.solid : s.tint,
        className,
      )}
    >
      <Icon className={expanded ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden />
      {expanded && label}
    </button>
  );
};
