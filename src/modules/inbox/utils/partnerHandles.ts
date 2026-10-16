import { normalizeHandle } from './conversationGroupKey';

/**
 * YOPA (Your Office and PA) answers SM's inbound phone calls and emails a message
 * ("Sears Melvin Memorials: YOPA Msg from …"). That is an INBOUND call by the customer,
 * answered by the partner service: it is never our reply (Arin, 2026-10-14). Only our
 * own outbound calls / emails / SMS / WhatsApps count as a reply.
 */
export const YOPA_DOMAINS: readonly string[] = ['yourofficeandpa.co.uk'];
const YOPA_SUBJECT_RE = /\bYOPA Msg\b/i;

function domainOf(handle: string | null | undefined): string {
  const n = normalizeHandle(handle ?? '');
  const at = n.lastIndexOf('@');
  return at < 0 ? '' : n.slice(at + 1);
}

export function isYopaHandle(handle: string | null | undefined): boolean {
  const d = domainOf(handle);
  return !!d && YOPA_DOMAINS.some((y) => d === y || d.endsWith(`.${y}`));
}

/** A YOPA call message (by sender domain or the YOPA subject line). */
export function isYopaMessage(m: { from_handle?: string | null; primary_handle?: string | null; subject?: string | null }): boolean {
  return isYopaHandle(m.from_handle ?? m.primary_handle) || YOPA_SUBJECT_RE.test(m.subject ?? '');
}

/**
 * Automated senders (no-reply, bounces, notifications): never a customer, never in the
 * Customers / Enquiries lanes; listed under "Spam & auto" with muted senders.
 */
const AUTO_LOCAL_RE = /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounces?|notifications?|alerts?|newsletter|news|marketing|updates?)([+._-].*)?$/i;

export function isAutomatedHandle(handle: string | null | undefined): boolean {
  const n = normalizeHandle(handle ?? '');
  const at = n.lastIndexOf('@');
  if (at <= 0) return false;
  return AUTO_LOCAL_RE.test(n.slice(0, at));
}
