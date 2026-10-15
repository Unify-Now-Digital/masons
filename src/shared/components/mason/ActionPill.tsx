import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { NextAction, NextActionKind, NextActionTone } from '@/shared/lib/nextAction';
import { nextActionStyle } from '@/shared/nextAction';

type PillKind = Exclude<NextActionKind, 'waiting' | 'none'>;

/**
 * Every pill/chip below renders through `nextActionStyle` (src/shared/nextAction.ts):
 * one label, colour (red act now · amber soon/money · green done · blue info) and icon
 * system across Inbox, conversation header, Orders, Hub, Finance and Pipeline.
 */
export interface ActionPillProps {
  kind: PillKind;
  label: string;
  /** Urgency of the action (red = act now). Defaults to neutral → amber. */
  tone?: NextActionTone;
  /** Solid only on the selected row / primary spot; tinted everywhere else. */
  solid?: boolean;
  className?: string;
  /** Overrides the icon nextActionStyle picks for this kind/label. */
  icon?: LucideIcon;
  /** Extra content after the label (e.g. the ✦ draft-ready mark). */
  trailing?: React.ReactNode;
  /** Neutral surface instead of the red/amber colour (work rows that are waiting / ok). */
  muted?: boolean;
  /** When set the pill renders as a real <button> (work rows); otherwise a read-only label. */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  'aria-label'?: string;
}

const MUTED_CLASS = 'bg-gardens-surf2 text-gardens-tx border border-gardens-bdr';

/** Action pill: a read-only label by default (rows stay one control), a button with onClick. */
export const ActionPill: React.FC<ActionPillProps> = ({ kind, label, tone = 'neutral', solid, className, icon, trailing, muted, onClick, 'aria-label': ariaLabel }) => {
  const s = nextActionStyle({ kind, tone, label });
  const Icon = icon ?? s.icon;
  const classes = cn(
    'inline-flex items-center gap-1 h-[26px] pl-2 pr-3 rounded-full text-xs font-bold whitespace-nowrap',
    muted ? MUTED_CLASS : solid ? s.classes.solid : s.classes.tint,
    onClick && 'focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc/40 hover:brightness-95',
    className,
  );
  const body = (
    <>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {s.label}
      {trailing}
    </>
  );
  if (onClick) {
    return (
      <button type="button" data-kind={kind} data-colour={muted ? 'neutral' : s.colour} onClick={onClick} aria-label={ariaLabel} className={classes}>
        {body}
      </button>
    );
  }
  return (
    <span data-kind={kind} data-colour={muted ? 'neutral' : s.colour} className={classes}>
      {body}
    </span>
  );
};

/** Blue (info) Waiting chip — never a button. */
export const WaitingChip: React.FC<{ label: string; className?: string }> = ({ label, className }) => {
  const s = nextActionStyle({ kind: 'waiting', tone: 'neutral', label });
  const Icon = s.icon;
  return (
    <span
      data-kind="waiting"
      data-colour={s.colour}
      className={cn('inline-flex items-center gap-1 h-[26px] pl-2 pr-3 rounded-full text-xs font-semibold whitespace-nowrap', s.classes.tint, className)}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {s.label}
    </span>
  );
};

/** Pill for any NextAction: action pill, Waiting chip, or nothing. */
export const NextActionPill: React.FC<{ action: NextAction; solid?: boolean; className?: string }> = ({ action, solid, className }) => {
  if (action.kind === 'none') return null;
  if (action.kind === 'waiting') return <WaitingChip label={action.label} className={className} />;
  return <ActionPill kind={action.kind} label={action.label} tone={action.tone} solid={solid} className={className} />;
};

export interface ActionChipProps extends ActionPillProps {
  /** Full label (selected row) vs a compact icon chip with the label as tooltip. */
  expanded?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Clickable action chip (inbox rows): compact icon chip on ordinary rows, the full
 * labelled action on the selected row. Rendered OUTSIDE the row button.
 */
export const ActionChip: React.FC<ActionChipProps> = ({ kind, label, tone = 'neutral', solid, expanded, className, onClick }) => {
  const s = nextActionStyle({ kind, tone, label });
  const Icon = s.icon;
  return (
    <button
      type="button"
      data-kind={kind}
      data-colour={s.colour}
      onClick={onClick}
      title={s.label}
      aria-label={s.label}
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-full text-xs font-bold whitespace-nowrap',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc/40 hover:brightness-95',
        expanded ? 'h-[26px] pl-2 pr-3' : 'h-[22px] w-[22px]',
        solid ? s.classes.solid : s.classes.tint,
        className,
      )}
    >
      <Icon className={expanded ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden />
      {expanded && s.label}
    </button>
  );
};
