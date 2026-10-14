/**
 * Universal next-action language (shell v2, Oct 2026). THE one place that decides how a
 * next action looks and reads anywhere in Mason: Inbox cards, the conversation header,
 * Orders "Next step", Hub, Finance and Pipeline all render through `nextActionStyle`
 * (via the shared ActionPill / NextActionPill components).
 *
 * Team colour language (operator input 14 Oct):
 *   red   = act now (overdue / blocked on us)
 *   amber = soon or watch (our move, not yet overdue; money to collect)
 *   green = done
 *   blue  = info (waiting on them, nothing for us to do)
 * Plain verbs: Reply, Call, Chase, Request deposit, Request balance, Record payment.
 * Colours are CSS tokens (--g-na-*) with light + dark values in styles/tokens.css.
 */
import {
  MessageCircleReply, Phone, BellRing, PoundSterling, Receipt, FilePlus2, Clock, CheckCircle2, Info, Package,
  type LucideIcon,
} from 'lucide-react';
import type { NextAction, NextActionKind } from '@/shared/lib/nextAction';

export type ActionColour = 'red' | 'amber' | 'green' | 'blue';

export type ActionVerb =
  | 'Reply' | 'Call' | 'Chase' | 'Request deposit' | 'Request balance' | 'Record payment'
  | 'Create order' | 'Order stone' | 'Waiting' | 'Done';

/** Verb + icon per action kind. Labels are plain verbs; the "why" lives in action.reason. */
export const ACTION_VERB: Record<NextActionKind, { verb: ActionVerb; icon: LucideIcon }> = {
  follow: { verb: 'Reply', icon: MessageCircleReply },
  order: { verb: 'Create order', icon: FilePlus2 },
  deposit: { verb: 'Request deposit', icon: PoundSterling },
  balance: { verb: 'Request balance', icon: PoundSterling },
  stone: { verb: 'Order stone', icon: Package },
  waiting: { verb: 'Waiting', icon: Clock },
  none: { verb: 'Done', icon: CheckCircle2 },
};

/** Icons for verbs passed as free labels (e.g. Finance "Chase", Sales "Call"). */
const VERB_ICON: Partial<Record<string, LucideIcon>> = {
  Reply: MessageCircleReply, Call: Phone, Chase: BellRing, 'Record payment': Receipt,
  'Request deposit': PoundSterling, 'Request balance': PoundSterling, Done: CheckCircle2, Waiting: Clock, Info,
};

/** Tailwind classes per colour. Tinted = default; solid = the selected row / primary. */
export const ACTION_COLOUR_CLASS: Record<ActionColour, { tint: string; solid: string; text: string }> = {
  red: { tint: 'bg-gardens-na-red-lt text-gardens-na-red', solid: 'bg-gardens-na-red text-gardens-na-on', text: 'text-gardens-na-red' },
  amber: { tint: 'bg-gardens-na-amber-lt text-gardens-na-amber', solid: 'bg-gardens-na-amber text-gardens-na-on', text: 'text-gardens-na-amber' },
  green: { tint: 'bg-gardens-na-green-lt text-gardens-na-green', solid: 'bg-gardens-na-green text-gardens-na-on', text: 'text-gardens-na-green' },
  blue: { tint: 'bg-gardens-na-blue-lt text-gardens-na-blue', solid: 'bg-gardens-na-blue text-gardens-na-on', text: 'text-gardens-na-blue' },
};

/** Colour of an action: red act now, amber our move soon / money, blue waiting, green done. */
export function actionColour(a: Pick<NextAction, 'kind' | 'tone'>): ActionColour {
  if (a.kind === 'none') return 'green';
  if (a.kind === 'waiting') return 'blue';
  return a.tone === 'red' ? 'red' : 'amber';
}

export interface NextActionStyle {
  label: string;
  colour: ActionColour;
  icon: LucideIcon;
  classes: (typeof ACTION_COLOUR_CLASS)[ActionColour];
}

/** The single rendering contract for a next action. `label` overrides the default verb. */
export function nextActionStyle(a: Pick<NextAction, 'kind' | 'tone'> & { label?: string }): NextActionStyle {
  const colour = actionColour(a);
  const base = ACTION_VERB[a.kind];
  const label = a.label?.trim() || base.verb;
  const icon = VERB_ICON[label] ?? base.icon;
  return { label, colour, icon, classes: ACTION_COLOUR_CLASS[colour] };
}
