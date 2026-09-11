import { normalizeHandle } from './conversationGroupKey';

/** Inputs used to build the org's own connected-mailbox handle set. */
export interface SelfHandleSources {
  gmailAddress?: string | null;
  gmailStatus?: string | null;
  whatsappFrom?: string | null;
  channelAccounts?: Array<{ account_identifier: string; is_connected: boolean }> | null;
}

/**
 * Normalized handles for the org's own connected mailboxes / senders.
 * Used to drop self-sync threads from All + Inquiries (and every list except Hidden).
 */
export function buildSelfHandles(sources: SelfHandleSources): Set<string> {
  const out = new Set<string>();
  if (sources.gmailAddress && (sources.gmailStatus == null || sources.gmailStatus === 'active')) {
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

/** True when this group's counterpart handle is one of our connected mailboxes. */
export function isSelfHandleGroup(
  groupKey: string,
  latestPrimaryHandle: string | null | undefined,
  selfHandles: Set<string>
): boolean {
  if (selfHandles.size === 0) return false;
  if (groupKey.startsWith('h:')) {
    return selfHandles.has(groupKey.slice(2));
  }
  const n = normalizeHandle(latestPrimaryHandle ?? '');
  return !!n && selfHandles.has(n);
}
