// GHL → inbox conversation-stub sync (V1 merge).
//
// Upserts one inbox_conversations stub per GHL conversation so GHL threads
// appear in the grouped Customers inbox. NO message ingestion — bodies stay
// live-fetched by the GHL tab (ghl-fetch). Dedupe key is the GHL conversation
// id stored in external_thread_id (inbox_conversations has no `meta` column,
// and link_meta is replaced wholesale by auto-link — nothing durable can live
// there).
//
// Channel mapping: TYPE_SMS → 'sms'; everything else → 'web'; TYPE_EMAIL
// conversations are skipped entirely (Gmail sync is the canonical email
// source — stubbing them would double-count threads).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { ghlFetch, type GhlConnectionRow } from './ghlClient.ts';
import { attemptAutoLink } from './autoLinkConversation.ts';
import { isRobotHandle } from './mutedSenderPatterns.ts';
import { normalizeHandle } from './normalizeHandle.ts';

// Verified live against /conversations/search (2026-07-26): limit=100 accepted;
// sortBy=last_message_date&sort=desc with startAfterDate=<epoch ms> pages
// strictly descending (cursor is exclusive).
const RECENT_PAGE_LIMIT = 20;
const BACKFILL_PAGE_LIMIT = 100;
const BACKFILL_CUTOFF_DAYS = 90;
const BACKFILL_MAX_PAGES = 30;

export type GhlSyncMode = { mode: 'recent' } | { mode: 'backfill' };

export type GhlSyncResult = {
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
  skippedNoHandle: number;
  errors: number;
};

type GhlSearchConversation = {
  id: string;
  phone: string;
  email: string;
  lastMessageDateMs: number | null;
  lastMessageType: string;
  lastMessageBody: string;
  unreadCount: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Accepts numeric or numeric-string epoch ms; null if unparseable. */
function asEpochMs(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mapSearchItem(raw: Record<string, unknown>): GhlSearchConversation | null {
  const id = asTrimmedString(raw.id);
  if (!id) return null;
  return {
    id,
    phone: asTrimmedString(raw.phone),
    email: asTrimmedString(raw.email),
    lastMessageDateMs: asEpochMs(raw.lastMessageDate),
    lastMessageType: asTrimmedString(raw.lastMessageType),
    lastMessageBody: asTrimmedString(raw.lastMessageBody),
    unreadCount: Number(raw.unreadCount) || 0,
  };
}

async function fetchSearchPage(
  apiKey: string,
  locationId: string,
  limit: number,
  startAfterDate?: number,
): Promise<GhlSearchConversation[]> {
  const params = new URLSearchParams({
    locationId,
    limit: String(limit),
    sortBy: 'last_message_date',
    sort: 'desc',
  });
  if (startAfterDate != null) params.set('startAfterDate', String(startAfterDate));

  const res = await ghlFetch(`/conversations/search?${params}`, apiKey);
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(`GHL /conversations/search failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const root = asRecord(data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(root?.conversations)
      ? (root!.conversations as unknown[])
      : Array.isArray(root?.data)
        ? (root!.data as unknown[])
        : [];

  return list
    .map((item) => asRecord(item))
    .map((r) => (r ? mapSearchItem(r) : null))
    .filter((c): c is GhlSearchConversation => c !== null);
}

/**
 * Find-or-upsert one stub. Returns the counter bucket the conversation
 * landed in. Service-role client — organization_id is stamped explicitly on
 * every write.
 */
async function upsertStub(
  supabase: SupabaseClient,
  organizationId: string,
  c: GhlSearchConversation,
  mutedSet: ReadonlySet<string> | undefined,
): Promise<'created' | 'updated' | 'skipped'> {
  // Gmail sync is the canonical email source.
  if (c.lastMessageType === 'TYPE_EMAIL') return 'skipped';

  // Never use contactId — alphanumeric ids normalize to '' on the frontend
  // and would create degenerate solo buckets. Raw phone preferred, else email.
  const handle = c.phone || c.email;
  if (!handle) return 'skipped';

  const channel = c.lastMessageType === 'TYPE_SMS' ? 'sms' : 'web';
  const lastMessageAtIso =
    c.lastMessageDateMs != null ? new Date(c.lastMessageDateMs).toISOString() : null;
  const preview = c.lastMessageBody.slice(0, 120) || null;
  const unreadCount = c.unreadCount;

  // Two probes of idx_inbox_conversations_external_thread_id via .in on the
  // leading column (channel can flip sms↔web between syncs). .limit(1) rather
  // than .maybeSingle() so a historical duplicate can never throw.
  const { data: rows, error: findError } = await supabase
    .from('inbox_conversations')
    .select('id, channel, status, last_message_at, unread_count')
    .eq('organization_id', organizationId)
    .in('channel', ['sms', 'web'])
    .eq('external_thread_id', c.id)
    .order('created_at', { ascending: true })
    .limit(1);
  if (findError) throw findError;

  const existing = rows?.[0] as
    | { id: string; channel: string; status: string; last_message_at: string | null; unread_count: number }
    | undefined;

  if (existing) {
    const activityAdvanced =
      lastMessageAtIso != null &&
      (existing.last_message_at == null || lastMessageAtIso > existing.last_message_at);

    if (!activityAdvanced && existing.unread_count === unreadCount && existing.channel === channel) {
      return 'skipped';
    }

    const { error: updateError } = await supabase
      .from('inbox_conversations')
      .update({
        channel,
        unread_count: unreadCount,
        last_message_at: lastMessageAtIso ?? existing.last_message_at,
        last_message_preview: preview,
        // Reopen on new activity so fresh GHL messages resurface closed stubs.
        ...(activityAdvanced ? { status: 'open' } : {}),
      })
      .eq('id', existing.id);
    if (updateError) throw updateError;
    return 'updated';
  }

  const { data: created, error: insertError } = await supabase
    .from('inbox_conversations')
    .insert({
      organization_id: organizationId,
      channel,
      primary_handle: handle,
      external_thread_id: c.id,
      subject: null,
      status: 'open',
      unread_count: unreadCount,
      last_message_at: lastMessageAtIso,
      last_message_preview: preview,
      link_state: 'unlinked',
      link_meta: {},
      user_id: null,
    })
    .select('id')
    .single();
  if (insertError || !created) throw insertError ?? new Error('insert returned no row');

  // Auto-mute robot/no-reply senders on first contact. Non-fatal — a failure
  // here must never fail the sync. (Email-only by design; phone handles never match.)
  if (isRobotHandle(handle)) {
    try {
      await supabase.from('inbox_muted_senders').upsert(
        {
          organization_id: organizationId,
          normalized_handle: normalizeHandle(handle),
          source: 'auto',
        },
        { onConflict: 'organization_id,normalized_handle', ignoreDuplicates: true },
      );
    } catch (muteError) {
      console.error('ghlConversationSync: auto-mute failed', muteError);
    }
  }

  // The channel param selects a match strategy (email vs last-10-digit phone),
  // not the row channel — derive it from the handle shape.
  try {
    await attemptAutoLink(
      supabase,
      created.id,
      handle.includes('@') ? 'email' : 'sms',
      handle,
      organizationId,
      { createIfMissing: true, mutedSet },
    );
  } catch (linkError) {
    console.error('ghlConversationSync: auto-link failed', linkError);
  }

  return 'created';
}

export async function syncGhlConversations(
  supabase: SupabaseClient,
  connection: GhlConnectionRow,
  apiKey: string,
  opts: GhlSyncMode,
): Promise<GhlSyncResult> {
  const result: GhlSyncResult = {
    scanned: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    skippedNoHandle: 0,
    errors: 0,
  };
  const organizationId = connection.organization_id;
  const locationId = connection.ghl_location_id;

  // FR-5 veto data: muted senders loaded ONCE per sync run and threaded
  // into upsertStub → attemptAutoLink (T025). Predicate matches
  // listMutedSenders/Hidden (unmuted_at IS NULL — tombstone semantics). On
  // load failure mutedSet stays undefined and attemptAutoLink's fail-closed
  // guard refuses creation (link-only degradation).
  let mutedSet: ReadonlySet<string> | undefined;
  const { data: mutedRows, error: mutedErr } = await supabase
    .from('inbox_muted_senders')
    .select('normalized_handle')
    .eq('organization_id', organizationId)
    .is('unmuted_at', null);
  if (mutedErr) {
    console.error('ghlConversationSync: muted-senders load failed — auto-create disabled this run', mutedErr);
  } else {
    mutedSet = new Set((mutedRows ?? []).map((r: { normalized_handle: string }) => r.normalized_handle));
  }

  const cutoffMs = Date.now() - BACKFILL_CUTOFF_DAYS * 24 * 60 * 60 * 1000;
  const limit = opts.mode === 'backfill' ? BACKFILL_PAGE_LIMIT : RECENT_PAGE_LIMIT;
  const maxPages = opts.mode === 'backfill' ? BACKFILL_MAX_PAGES : 1;

  let startAfterDate: number | undefined;
  let previousFirstId: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const items = await fetchSearchPage(apiKey, locationId, limit, startAfterDate);
    if (items.length === 0) break;

    // Broken/ignored-cursor guard: identical page start means we're looping.
    if (items[0].id === previousFirstId) {
      console.error('ghlConversationSync: pagination cursor not advancing, aborting');
      break;
    }
    previousFirstId = items[0].id;

    let sawOlderThanCutoff = false;
    for (const c of items) {
      if (opts.mode === 'backfill' && c.lastMessageDateMs != null && c.lastMessageDateMs < cutoffMs) {
        sawOlderThanCutoff = true;
        continue;
      }
      result.scanned++;
      const hasHandle = !!(c.phone || c.email);
      try {
        const outcome = await upsertStub(supabase, organizationId, c, mutedSet);
        result[outcome]++;
        if (outcome === 'skipped' && !hasHandle && c.lastMessageType !== 'TYPE_EMAIL') {
          result.skippedNoHandle++;
        }
      } catch (error) {
        result.errors++;
        console.error(`ghlConversationSync: upsert failed for GHL conversation ${c.id}`, error);
      }
    }

    if (opts.mode !== 'backfill') break;
    // Descending pages: the first older-than-cutoff item means everything
    // after it (this page and all later pages) is older too.
    if (sawOlderThanCutoff) break;
    if (items.length < limit) break;

    const oldest = items[items.length - 1].lastMessageDateMs;
    if (oldest == null) break;
    startAfterDate = oldest;
  }

  return result;
}
