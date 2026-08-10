// Robot/no-reply sender detection for the auto-mute hook in the Gmail sync
// functions. A handle matching here gets an `inbox_muted_senders` row with
// source='auto' when its conversation is first created.
//
// IMPORTANT: normalization here (lowercase + trim for email handles) MUST stay
// in lockstep with normalizeHandle in
// src/modules/inbox/utils/conversationGroupKey.ts — the frontend reads
// `normalized_handle` values produced by that rule, so a drift means auto-muted
// rows stop matching their conversations. If either side changes, change both.

import { normalizeHandle } from './normalizeHandle.ts';

/** Local-part prefixes that mark an address as automated/no-reply. Exported for tests. */
export const ROBOT_LOCAL_PART_REGEX =
  /^(no-?reply|donotreply|do-not-reply|notifications?|alerts?|mailer-daemon|postmaster|bounces?|auto-confirm|account-update|trackingupdates|shipment-tracking|receipts\+)/;

/**
 * True iff `handle` is an email-shaped handle whose local part starts with a
 * known robot/no-reply prefix. Non-email handles (no '@') are never robots.
 *
 * Normalizes internally (trim+lowercase). That is LOAD-BEARING for the three
 * raw-handle callers (the auto-mute gates in gmail-sync-now, inbox-gmail-sync,
 * ghlConversationSync all pass untrimmed/mixed-case handles) and
 * redundant-but-idempotent when called from shouldAutoCreatePerson, which
 * normalizes first. Keep both normalizations (ruling 10 Aug 2026).
 */
export function isRobotHandle(handle: string): boolean {
  const normalized = handle.trim().toLowerCase();
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0) return false;
  return ROBOT_LOCAL_PART_REGEX.test(normalized.slice(0, atIndex));
}

/**
 * FR-5 step 6: consumer-email allowlist (v1), exact match on the lowered
 * domain. SM domain rollup (10 Aug 2026): every real prospect is on consumer
 * email; every business-domain sender is a supplier, insurer, SaaS, relay,
 * or own infrastructure — an allowlist matches the data's grain where a
 * denylist would enumerate an open set. Extend when a real prospect's domain
 * misses — that miss costs one assisted click (FR-6), never bad data.
 */
export const CONSUMER_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'live.co.uk',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'btinternet.com',
  'btopenworld.com',
  'sky.com',
  'talktalk.net',
  'virginmedia.com',
  'blueyonder.co.uk',
  'ntlworld.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'gmx.com',
  'gmx.co.uk',
]);

/**
 * FR-5 step 5: staff/own-infrastructure handles that must never auto-create
 * a person. Exact handles cover staff-personal addresses on consumer domains
 * (which would otherwise pass the CONSUMER_EMAIL_DOMAINS step —
 * ArinMelvin@gmail.com appears in the unlinked data as proof). Domain
 * suffixes cover own infrastructure (endsWith('.'+d) || === d, so
 * lc.unifynow.digital is covered). Input must already be normalized
 * (lowered/trimmed).
 */
const STAFF_EXACT_HANDLES: ReadonlySet<string> = new Set([
  'arinmelvin@gmail.com',
  'kotchlamazashvili.giorgi@gmail.com',
]);

const OWN_DOMAINS: readonly string[] = [
  'searsmelvin.co.uk',
  'unifynow.digital',
  // TODO-CHURCHILL-DOMAIN: cannot be derived from data (Churchill has zero
  // email conversations; GHL merge deferred). MUST be filled before
  // Churchill ingestion goes live — not a Commit B blocker.
];

export function isStaffOrOwnHandle(normalized: string): boolean {
  if (STAFF_EXACT_HANDLES.has(normalized)) return true;
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex < 0) return false;
  const domain = normalized.slice(atIndex + 1);
  return OWN_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d));
}

/**
 * FR-5 creation gate: should a zero-match handle auto-create a person?
 * Order is load-bearing (spec FR-5, final):
 *   1. normalize — same fn as the mute path, so veto and Hidden never drift
 *      (1a. normalized to '' → false — fail-closed on digit-less junk
 *      handles; spec amendment 10 Aug 2026)
 *   2. muted veto — BEFORE the phone short-circuit, so manually muted phone
 *      handles are un-creatable (auto-mute is email-only; manual mutes may
 *      not be)
 *   3. phone handle (no '@') → create
 *   4. robot/no-reply → never
 *   5. staff/own infrastructure → never
 *   6. consumer email domain → create
 *   7. business domain → never (the FR-6 assisted path decides)
 * Pure: mutedSet is loaded by the caller (once per sync run, org-scoped,
 * unmuted_at IS NULL — the listMutedSenders predicate). This module never
 * writes inbox_muted_senders.
 */
export function shouldAutoCreatePerson(
  handle: string,
  mutedSet: ReadonlySet<string>,
): boolean {
  const normalized = normalizeHandle(handle);
  if (!normalized) return false;
  if (mutedSet.has(normalized)) return false;
  if (!normalized.includes('@')) return true;
  if (isRobotHandle(normalized)) return false;
  if (isStaffOrOwnHandle(normalized)) return false;
  const domain = normalized.slice(normalized.lastIndexOf('@') + 1);
  return CONSUMER_EMAIL_DOMAINS.has(domain);
}
