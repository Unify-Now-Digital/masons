# Tasks: Unified Inbox Live Updates

## Phase 0: SQL and Realtime setup

- [ ] **0.1** Confirm Realtime publication includes `inbox_messages`. (See quickstart.md for Dashboard steps.)
- [X] **0.2** Verify unique index; added migration `20260205140000_inbox_messages_dedup_channel_external_id.sql` for (channel, external_message_id) dedup.
- [X] **0.3** Confirm tenant column: existing inbox queries do not filter by company_id/org_id; no Realtime filter; RLS applies.

---

## Phase 1: Realtime subscription (frontend)

- [X] **1.1** In `src/modules/inbox/pages/UnifiedInboxPage.tsx`: add a single Realtime subscription at page level (not inside ConversationView or any child).
  - Use `supabase.channel('inbox-messages')` (or similar unique name).
  - Subscribe to `postgres_changes` on `public.inbox_messages`, event `INSERT` (and optionally `UPDATE`).
  - If tenant column exists: use `.filter('company_id', 'eq', currentCompanyId)` or `.filter('org_id', 'eq', currentOrgId)` (obtain from app context; if no context, omit filter and rely on RLS).
  - Subscribe in `useEffect` on mount; return cleanup that unsubscribes/removes channel on unmount.
- [X] **1.2** On payload: extract `conversation_id` from `payload.new`; debounce 200ms; invalidate only (no cache patch).
- [X] **1.3** Import `inboxKeys` and `useQueryClient`; single channel.
- [X] **1.4** Do not change scroll guard or auto-read prevention logic in `UnifiedInboxPage` or `ConversationView`.

**Files to change:**
- `src/modules/inbox/pages/UnifiedInboxPage.tsx` — add effect with Realtime subscription, debounced invalidation using `inboxKeys.conversations.all` and `inboxKeys.messages.byConversation(conversationId)`.

---

## Phase 2: Gmail auto-sync and remove Sync button

**Strategy A (preferred): Supabase scheduled Edge Function**

- [ ] **2A.1** Configure a scheduled invocation of `inbox-gmail-sync` every 60 seconds (e.g. Supabase Cron, or external cron calling the Edge Function URL with auth). Document in `specs/unified-inbox-live-updates-plan/quickstart.md` or README: schedule (e.g. `*/1 * * * *`), endpoint, and how to enable.
- [ ] **2A.2** Remove the "Sync Email" button and `handleSyncEmail` from `UnifiedInboxPage.tsx`. Remove or keep `useSyncGmail` for optional programmatic use (e.g. manual trigger in settings); if kept, do not expose a button in the inbox header.
- [ ] **2A.3** No client-side polling when using Strategy A.

**Strategy B (fallback): Client-side 60s polling**

- [X] **2B.1** In `UnifiedInboxPage.tsx`: 60s setInterval, guard with ref to avoid overlapping.
- [X] **2B.2** useSyncGmail invalidates inboxKeys.conversations.all and ['inbox', 'messages'].
- [X] **2B.3** Remove the "Sync Email" button and handleSyncEmail.

**Files to change:**
- `src/modules/inbox/pages/UnifiedInboxPage.tsx` — remove Sync Email button and `handleSyncEmail`; add either (A) no client code for sync or (B) 60s interval + cleanup.
- If Strategy A: add or update docs (e.g. `specs/unified-inbox-live-updates-plan/quickstart.md`, README) with Edge Function scheduling instructions.

---

## Phase 3: Optional Gmail sync invalidation (messages)

- [X] **3.1** After Gmail sync success: useSyncGmail onSuccess invalidates ['inbox', 'messages'] so open thread refetches.

**Files to change (if needed):**
- `src/modules/inbox/hooks/useInboxConversations.ts` — extend `useSyncGmail` onSuccess to invalidate messages for selected conversation, or
- `UnifiedInboxPage.tsx` — in sync success callback, call `queryClient.invalidateQueries({ queryKey: inboxKeys.messages.byConversation(selectedConversationId) })` when `selectedConversationId` is set.

---

## Phase 4: Test checklist

- [ ] **SMS/WhatsApp Realtime:** Send an inbound SMS/WhatsApp that triggers the Twilio webhook → insert into `inbox_messages`. Without refreshing the page: (1) conversation list updates (new or updated conversation, last_message_preview, unread); (2) if that conversation is selected, the message timeline updates with the new message. No duplicate messages.
- [ ] **Gmail within 60s:** With Strategy A: wait for cron run; with Strategy B: wait up to 60s with inbox open. New email appears in the list and, if that conversation is open, in the timeline. No "Sync Email" button.
- [ ] **No scroll regressions:** Switch between conversations; scroll within a conversation; open a conversation with unread — scroll position and page scroll behavior match current behavior (scroll guard and auto-read prevention unchanged).
- [ ] **Deduplication:** Trigger webhook or sync twice with same external_message_id; only one message row and one UI message.
- [ ] **RLS / tenant:** If multi-tenant, confirm that only messages for the current tenant are received (Realtime filter or RLS) and that list/timeline show no cross-tenant data.

---

## Summary: exact files

| File | Changes |
|------|--------|
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Realtime subscription (one channel, debounced invalidation); remove Sync Email button and handleSyncEmail; optional 60s polling (Strategy B). |
| `src/modules/inbox/hooks/useInboxConversations.ts` | Optional: useSyncGmail onSuccess invalidate messages for selected conversation. |
| `supabase/migrations/` | Optional: enable Realtime for `inbox_messages`; optional: unique index on `external_message_id` if missing. |
| `specs/unified-inbox-live-updates-plan/quickstart.md` | Run app, verify live updates, document Gmail 60s schedule (Strategy A) or polling (Strategy B). |

**React Query keys used (no changes to key definitions):**
- `inboxKeys.conversations.all` — invalidate conversation list.
- `inboxKeys.messages.byConversation(conversationId)` — invalidate open thread for that conversation.

**Realtime:** One subscription at `UnifiedInboxPage` to `inbox_messages` INSERT (filter by `company_id` or `org_id` if column exists). Handler only invalidates; debounce 300–500 ms.
