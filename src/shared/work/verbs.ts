/**
 * One verb label table, used by every screen (A.3). TodayPage's own VERB_LABEL/PREPARED and
 * the tables in src/shared/lib/nextAction.ts / src/shared/nextAction.ts are NOT deleted here —
 * that consolidation is Phase D. This file is not wired into any screen yet.
 */
// TODO(Phase D): re-point TodayPage's VERB_LABEL/PREPARED and nextAction.ts's label tables at
// this file, then delete the duplicates (A.3: "Delete the duplicates").
import type { Verb } from './types';

export const VERB_LABEL: Record<Verb, string> = {
  reply: 'Reply',
  quote: 'Send quote',
  chase: 'Chase',
  send_permit: 'Send permit form',
  chase_council: 'Chase council',
  fix_permit: 'Fix permit',
  send_proof: 'Send proof',
  chase_proof: 'Chase proof',
  revise_proof: 'Revise proof',
  request_deposit: 'Request deposit',
  request_balance: 'Request balance',
  record_payment: 'Record payment',
  reconcile: 'Reconcile',
};

/** Lucide icon names (strings, not components — no React import in this module).
 * Reused from the icons already used in src/shared/nextAction.ts's ACTION_VERB where they apply. */
export const VERB_ICON: Record<Verb, string> = {
  reply: 'MessageCircleReply',
  quote: 'FilePlus2',
  chase: 'BellRing',
  send_permit: 'FilePlus2',
  chase_council: 'BellRing',
  fix_permit: 'Wrench',
  send_proof: 'Image',
  chase_proof: 'BellRing',
  revise_proof: 'Image',
  request_deposit: 'PoundSterling',
  request_balance: 'PoundSterling',
  record_payment: 'Receipt',
  reconcile: 'Scale',
};
