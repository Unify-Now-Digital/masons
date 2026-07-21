// Robot/no-reply sender detection for the auto-mute hook in the Gmail sync
// functions. A handle matching here gets an `inbox_muted_senders` row with
// source='auto' when its conversation is first created.
//
// IMPORTANT: normalization here (lowercase + trim for email handles) MUST stay
// in lockstep with normalizeHandle in
// src/modules/inbox/utils/conversationGroupKey.ts — the frontend reads
// `normalized_handle` values produced by that rule, so a drift means auto-muted
// rows stop matching their conversations. If either side changes, change both.

/** Local-part prefixes that mark an address as automated/no-reply. Exported for tests. */
export const ROBOT_LOCAL_PART_REGEX =
  /^(no-?reply|donotreply|do-not-reply|notifications?|alerts?|mailer-daemon|postmaster|bounces?|auto-confirm|account-update|trackingupdates|shipment-tracking|receipts\+)/;

/**
 * True iff `handle` is an email-shaped handle whose local part starts with a
 * known robot/no-reply prefix. Non-email handles (no '@') are never robots.
 */
export function isRobotHandle(handle: string): boolean {
  const normalized = handle.trim().toLowerCase();
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0) return false;
  return ROBOT_LOCAL_PART_REGEX.test(normalized.slice(0, atIndex));
}
