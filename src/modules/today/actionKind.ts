/**
 * Six action kinds for Today (spec 11a.1). Mapped from the Hub verb, not stored.
 * A reply more than 7 days past its lane limit becomes a call (11a.2).
 */
import { BellRing, Package, PencilLine, Phone, Reply, Send, type LucideIcon } from 'lucide-react';
import type { Verb } from './todayModel';

export type ActionKind = 'reply' | 'call' | 'chase' | 'send' | 'order' | 'fix';

export const KIND_LABEL: Record<ActionKind, string> = {
  reply: 'Reply', call: 'Call', chase: 'Chase', send: 'Send', order: 'Order', fix: 'Fix',
};

export const KIND_ICON: Record<ActionKind, LucideIcon> = {
  reply: Reply, call: Phone, chase: BellRing, send: Send, order: Package, fix: PencilLine,
};

/** Hours past the lane limit after which a reply is a call, and the row is `old`. */
export const CALL_AFTER_HOURS = 168;

/**
 * Every Hub verb, including the shared-lane labels cast onto `Verb` in sharedLanes.
 * Customer message waiting on us → reply. Third party → chase. Form, proof or invoice
 * to dispatch → send. Data gaps (unrecorded amount, void invoice, unmatched payment) → fix.
 * No current verb is a stone order, so `order` is unused until a rule emits one.
 */
const VERB_KIND = {
  REPLY: 'reply',
  CALL: 'call',
  CHASE: 'chase',
  QUOTE: 'send',
  INVOICE: 'send',
  'SOFT FUP': 'chase',
  CONFIRM: 'reply',
  'Send form': 'send',
  'Send proof': 'send',
  'Acknowledge form': 'reply',
  'Submit & pay fee': 'send',
  'Match payment': 'fix',
  'Request balance': 'send',
  'Record payment': 'fix',
  FLAG: 'fix',
  WAIT: 'chase',
  Reply: 'reply',
  Call: 'call',
  Chase: 'chase',
  'Make first contact': 'reply',
  'Waiting on deposit': 'chase',
  'Chase deposit': 'chase',
  'Waiting on them': 'chase',
  'Gentle follow-up': 'chase',
  'Send quote': 'send',
  Waiting: 'chase',
  'Request deposit': 'send',
} as const satisfies Record<Verb, ActionKind>;

export function kindFor(item: { verb: Verb; lateBy?: number | null }): ActionKind {
  const base: ActionKind = VERB_KIND[item.verb];
  if (base === 'reply' && item.lateBy != null && item.lateBy > CALL_AFTER_HOURS) return 'call';
  return base;
}
