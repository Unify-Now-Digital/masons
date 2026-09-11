import { normalizeHandle } from './conversationGroupKey';

/** Inputs used to build the org's own connected-mailbox handle set. */
export interface SelfHandleSources {
  gmailAddress?: string | null;
  whatsappFrom?: string | null;
  channelAccounts?: Array<{ account_identifier: string; is_connected: boolean }> | null;
}

/**
 * Normalized handles for the org's own mailboxes / senders.
 * Used to drop self-sync threads from All + Inquiries (and every list except Hidden).
 * The Gmail address counts regardless of connection status: the org's address is
 * the org's address whether the connection is active or revoked (same rule as
 * needsAttention.ts isUnlinkedOrgMailbox).
 */
export function buildSelfHandles(sources: SelfHandleSources): Set<string> {
  const out = new Set<string>();
  if (sources.gmailAddress) {
    const n = normalizeHandle(sources.gmailAddress);
    if (n) out.add(n);
  }
  if (sources.whatsappFrom) {
    const n = normalizeHandle(sources.whatsappFrom);
    if (n) out.add(n);
  }
  for (const acct of sources.channelAccounts ?? []) {
    if (!acct.is_connected) continue;
    const n = normalizeHandle(acct.account_identifier);
    if (n) out.add(n);
  }
  return out;
}

/**
 * True when this UNLINKED group's handle is one of our own mailboxes.
 * Linked (`p:`) groups are never self: a real person whose latest thread happens
 * to carry the org mailbox stays visible (mirrors needsAttention.ts, which only
 * excludes unlinked org-mailbox conversations).
 */
export function isSelfHandleGroup(groupKey: string, selfHandles: Set<string>): boolean {
  if (selfHandles.size === 0) return false;
  if (!groupKey.startsWith('h:')) return false;
  return selfHandles.has(groupKey.slice(2));
}
