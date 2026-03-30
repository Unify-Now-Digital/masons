# Unified Inbox — Live Updates (WhatsApp/SMS Realtime + Gmail Auto-Sync)

## Overview

**Goal:** Make the Unified Inbox update automatically so users see new messages without refreshing the page.

1. **WhatsApp/SMS:** New inbound messages (from Twilio webhooks inserting into `inbox_messages`) appear in the UI instantly via Supabase Realtime.
2. **Gmail:** Remove the manual "Sync Email" button and sync automatically every 60 seconds (server-side schedule preferred; client polling as fallback).

**Context:**
- Mason app architecture is locked: Invoices → Orders → Jobs → Installations. No structural changes.
- Backend: Supabase only; RLS enabled; no custom Node server.
- Frontend: React, TypeScript, React Query, Tailwind/shadcn.
- Inbox is stable; preserve existing scroll guard, auto-read prevention, and single-render panels.
- Safe pattern: Realtime events should **invalidate React Query caches** (refetch), not manually patch client state.
- Existing tables: `inbox_messages`, `inbox_conversations`, `inbox_channel_accounts`.
- Edge Function: `inbox-gmail-sync` exists and is invoked by the current "Sync Email" button.

---

## Current State Analysis

### inbox_messages

**Table:** `public.inbox_messages`

**Current structure (from migrations and usage):**
- Used for all channels (email, sms, whatsapp).
- Columns referenced: `id`, `conversation_id`, `external_message_id` (for dedupe), channel-related fields, body, timestamps, etc.
- Unique constraint: `idx_inbox_messages_external_message_id` on `(external_message_id)` WHERE `external_message_id IS NOT NULL` — ensures no duplicate messages from webhook retries.

**Observations:**
- Twilio SMS/WhatsApp webhooks insert into `inbox_messages` (and upsert/update `inbox_conversations`).
- Gmail sync (Edge Function `inbox-gmail-sync`) inserts/updates `inbox_messages` and `inbox_conversations`.
- No Supabase Realtime subscription is currently used for inbox; UI only updates on manual refetch or after user actions (e.g. after sending, or after clicking "Sync Email").

### inbox_conversations

**Table:** `public.inbox_conversations`

**Current structure:**
- Columns: `id`, `channel`, `status`, `person_id`, `link_state`, `last_message_at`, `last_message_preview`, `unread_count`, `external_thread_id`, etc.
- List is ordered by `last_message_at DESC`; conversation view shows messages for selected `conversation_id`.

**Observations:**
- When a new message is inserted into `inbox_messages`, the corresponding conversation’s `last_message_at` / `last_message_preview` / `unread_count` may be updated by the webhook or Edge Function.
- For list and timeline to update live, the client must either subscribe to `inbox_messages` (and invalidate conversation list + message queries) or subscribe to both `inbox_messages` and `inbox_conversations`.

### Data access patterns

**Conversations:** `useConversationsList(filters)` → `fetchConversations(filters)` → Supabase `inbox_conversations` with filters (status, channel, person_id, search, etc.). Query key: `inboxKeys.conversations.lists(filters)`.

**Messages:** `useMessagesByConversation(conversationId)` → `fetchMessagesByConversation(conversationId)` → Supabase `inbox_messages` for that conversation. Query key: `inboxKeys.messages.byConversation(conversationId)`.

**Gmail sync:** `useSyncGmail()` → `syncGmail()` → POST to Edge Function `inbox-gmail-sync`. "Sync Email" button in `UnifiedInboxPage` triggers this; no automatic interval.

**Relationship:**
- New row in `inbox_messages` → belongs to one `inbox_conversations` row. Conversation list and open conversation timeline should reflect the new message after cache invalidation and refetch.

---

## Recommended Approach

### 1. Realtime (WhatsApp/SMS and consistency)

- **Subscribe to** `public.inbox_messages` **INSERT** (and optionally UPDATE if needed for edits).
- **Filter:** Use Supabase Realtime filters so only relevant rows are received (e.g. by `company_id` if RLS/tenant scoping uses it; otherwise no filter or minimal).
- **On event:** Invalidate React Query:
  - `inboxKeys.conversations.lists(...)` (all list variants used on the page, or a broad invalidation like `inboxKeys.conversations.all`) so the conversation list refetches (last_message_preview, unread, ordering).
  - `inboxKeys.messages.byConversation(conversationId)` for the conversation that received the message (derive `conversation_id` from the payload) so the open thread refetches.
- Do **not** manually merge the new message into cache; let refetch keep a single source of truth and avoid duplicate/ordering bugs.
- Preserve existing scroll guard and auto-read behavior (no changes to that logic).

### 2. Gmail auto-sync (60s)

- **Preferred:** Server-side schedule (Supabase Cron or external cron) that invokes `inbox-gmail-sync` every 60 seconds. No change to Edge Function contract; only invocation is scheduled.
- **Fallback:** If server-side scheduling is not available, use client-side polling: when the Unified Inbox page is mounted and the Email tab is active (or All), call `syncGmail()` every 60s (e.g. `setInterval` or a refetch interval on a “sync status” query). After sync, invalidate the same React Query keys as for Realtime so list and open conversation update.
- **Remove** the "Sync Email" button from the inbox header.

### 3. Deduplication

- **inbox_messages:** Keep existing `external_message_id` unique constraint for Twilio (and similar) webhook idempotency.
- Gmail sync (Edge Function) should continue to use existing idempotency (e.g. by `external_message_id` or equivalent) so no duplicate messages when sync runs every 60s.

### 4. RLS / tenant scoping

- Realtime subscriptions respect RLS. Ensure `inbox_messages` (and `inbox_conversations` if subscribed) have RLS policies that match how the app queries data (e.g. by `company_id` or `auth.uid()`). No new policies required if current RLS already restricts rows by tenant; only ensure Realtime is enabled for these tables.

---

## Implementation Plan

### Phase 1: Enable Realtime and SQL (if needed)

- Confirm Supabase Realtime is enabled for `public.inbox_messages` (Dashboard → Database → Replication).
- If not, add publication for `inbox_messages` (and optionally `inbox_conversations` for conversation-level updates).
- Verify unique constraint on `inbox_messages.external_message_id` exists for dedupe; add if missing.
- No schema change to application columns required unless a unique constraint is missing.

### Phase 2: Subscribe in frontend and invalidate queries

- In `UnifiedInboxPage` (or a dedicated hook used by it), create a Supabase Realtime channel for `postgres_changes` on `inbox_messages` (event: `INSERT`, optionally `UPDATE`).
- On payload: extract `conversation_id` (and optionally `company_id` for tenant check). Invalidate:
  - `queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all })` (or list keys used on the page) so conversation list refetches.
  - `queryClient.invalidateQueries({ queryKey: inboxKeys.messages.byConversation(conversationId) })` for the affected `conversation_id` so the open thread refetches if that conversation is selected.
- Subscribe when the inbox page is mounted; unsubscribe on unmount. Use a stable channel name and single subscription to avoid duplicate handlers.
- Preserve scroll guard and auto-read logic; no change to ConversationView or message rendering.

### Phase 3: Gmail auto-sync (60s) and remove Sync button

- **Option A (server):** Configure a cron job (e.g. Supabase Cron or external) to POST to `inbox-gmail-sync` every 60 seconds. Document the schedule. No frontend change except removing the button.
- **Option B (client):** If Option A is not possible, add a 60s interval on the inbox page (or when Email/All tab is active) that calls `syncGmail()`, then invalidates the same React Query keys as in Phase 2. Ensure only one timer is active and it is cleared on unmount.
- Remove the "Sync Email" button and its click handler from `UnifiedInboxPage`. Remove or keep `useSyncGmail` for programmatic use (e.g. Option B).

### Phase 4: Verification and edge cases

- Test: Send WhatsApp/SMS to a number that triggers the Twilio webhook → insert into `inbox_messages` → UI updates without refresh (list + open conversation).
- Test: Gmail sync runs every 60s (server or client); new emails appear within ~60s without clicking Sync.
- Test: No duplicate messages when webhook or sync runs multiple times (unique constraint / idempotency).
- Test: RLS and tenant scoping still apply; users only see their tenant’s data.
- Test: Conversation list order and unread counts update when new messages arrive; selected conversation timeline updates when the new message is in that conversation.

---

## Deliverables Checklist

- [ ] **Tables/columns:** Document or confirm `inbox_messages` (and if needed `inbox_conversations`) as the target for Realtime; identify filter columns (e.g. `company_id`) for subscription filter if used.
- [ ] **SQL:** Enable Realtime replication for `inbox_messages` (and optionally `inbox_conversations`); add unique constraint on `inbox_messages.external_message_id` if missing.
- [ ] **Code:** UnifiedInboxPage (or inbox hook) subscribes to `inbox_messages` INSERT (and optionally UPDATE); on event, invalidate `inboxKeys.conversations` and `inboxKeys.messages.byConversation(conversationId)`.
- [ ] **Code:** Remove "Sync Email" button; implement automatic Gmail sync every 60s (server cron or client polling).
- [ ] **Docs:** Note in spec or README how Gmail 60s sync is triggered (cron vs client).

---

## What NOT to Do

- Do not add a custom Node/Express server for realtime or sync.
- Do not manually patch React Query cache with the new message object; always invalidate and refetch.
- Do not change scroll guard, auto-read prevention, or single-render panel behavior in the inbox.
- Do not remove or relax RLS on `inbox_messages` / `inbox_conversations`.
- Do not change the contract of `inbox-gmail-sync` Edge Function (only invocation method changes).

---

## Open Questions / Considerations

- **Supabase Cron:** Confirm whether the project uses Supabase Cron (or similar) for scheduling; if not, client polling is the fallback for 60s Gmail sync.
- **Realtime filter:** If the app is multi-tenant with `company_id` on `inbox_messages`, the subscription should filter by `company_id` to avoid leaking events across tenants; confirm column and RLS design.
- **Broad invalidation vs granular:** Invalidating all conversation lists (e.g. `inboxKeys.conversations.all`) is simpler but may refetch more than needed; granular invalidation by filter is possible if needed for performance.
