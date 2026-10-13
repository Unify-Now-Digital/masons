import { normalizeHandle } from './conversationGroupKey';

/**
 * Own-infrastructure email domains. MIRROR of OWN_DOMAINS in
 * supabase/functions/_shared/mutedSenderPatterns.ts — Deno code cannot be
 * imported here, so a change to either list changes both. Staff handles
 * (STAFF_EXACT_HANDLES there) stay server-side: no personal addresses in src.
 * Global, not org-scoped; a per-org own-handles table is backlog (ruling
 * 2026-10-13). Exact-domain match only; the Deno side also matches subdomains.
 */
export const OWN_EMAIL_DOMAINS: readonly string[] = ['searsmelvin.co.uk', 'unifynow.digital'];

/** Handles and domains that identify the org itself, never a customer. */
export interface OwnHandles {
  /** normalizeHandle output: the org's connected mailboxes / senders. */
  handles: ReadonlySet<string>;
  /** Lower-case email domains, matched exactly against the part after '@'. */
  domains: readonly string[];
}

/** `connected`: raw gmail_connections.email_address / whatsapp_connections.whatsapp_from. */
export function buildOwnHandles(connected: ReadonlyArray<string | null | undefined>): OwnHandles {
  const handles = new Set<string>();
  for (const raw of connected) {
    const normalized = normalizeHandle(raw ?? '');
    if (normalized) handles.add(normalized);
  }
  return { handles, domains: OWN_EMAIL_DOMAINS };
}

export function isOwnHandle(handle: string | null | undefined, own: OwnHandles): boolean {
  const normalized = normalizeHandle(handle ?? '');
  if (!normalized) return false;
  if (own.handles.has(normalized)) return true;
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex < 0) return false;
  return own.domains.includes(normalized.slice(atIndex + 1));
}

/** LIKE wildcards are literal in a handle; backslash is LIKE's default escape. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Quoted value for a PostgREST logic tree: `"` and `\` are backslash-escaped. */
function quoteValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (ch) => `\\${ch}`)}"`;
}

/**
 * PostgREST `or` filter that keeps a conversation unless it is UNLINKED and its
 * handle is one of ours. Emails match exactly (ilike, so case-insensitive);
 * phone handles, normalized to their last 10 digits, match as a suffix; own
 * domains as `*@domain` (`*` is PostgREST's wildcard). A null primary_handle
 * fails every `not.ilike`, so an unlinked row with no handle is excluded too —
 * the customers list never renders those either.
 */
export function ownHandleKeepFilter(own: OwnHandles): string {
  const patterns = [
    ...[...own.handles].map((h) => (h.includes('@') ? escapeLike(h) : `*${escapeLike(h)}`)),
    ...own.domains.map((d) => `*@${escapeLike(d)}`),
  ];
  const misses = patterns.map((p) => `primary_handle.not.ilike.${quoteValue(p)}`).join(',');
  return `person_id.not.is.null,and(${misses})`;
}
