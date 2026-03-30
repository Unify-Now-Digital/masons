# Plan: Fix Stale Historical Gmail Message body_text Corruption

**Branch:** feature/inbox-georgian-preview-vs-body-path-investigation  
**Spec:** [specs/inbox-georgian-preview-vs-body-path-investigation.md](../inbox-georgian-preview-vs-body-path-investigation.md)

---

## 1. Root-cause summary

- **Card** uses **inbox_conversations.subject** (first message’s Subject header) and **inbox_conversations.last_message_preview** (latest message’s body slice). Both can look correct (subject from headers; preview from the newest synced message).
- **Thread** uses **inbox_messages.body_text** per message. Gmail sync writes `body_text` only on **insert**; when a message is considered a duplicate (same Gmail message ID), sync **skips** and does **not** update the existing row.
- So **older** Gmail message rows can keep **stale/corrupted** `body_text` from when they were first synced (bad decoding or snippet fallback). The card looks correct because it shows subject + **latest** message’s preview; the corrupted text is from an **older** message’s `body_text` (or, in a single-message thread, the same message’s row was never refreshed after extraction was fixed).
- **Conclusion:** The problem is **stale historical body_text** in **inbox_messages**. Fix: refresh `body_text` for existing Gmail message rows by re-fetching from Gmail and re-running extraction, then updating only the affected fields.

---

## 2. Exact files / functions / DB fields

| Role | Location | DB field |
|------|----------|----------|
| Where body_text is written (insert only; duplicate = skip) | `supabase/functions/gmail-sync-now/index.ts`: duplicate check ~329–330, insert ~332–345 | **inbox_messages.body_text** |
| Where last_message_preview is set | `gmail-sync-now/index.ts`: conversation insert ~305, conversation update ~361–362 | **inbox_conversations.last_message_preview** |
| Body extraction | `gmail-sync-now/index.ts`: `extractBodyText(payload)` ~34–65 | N/A (in-memory) |
| Thread rendering | `src/modules/inbox/components/ConversationThread.tsx`: `message.body_text` | **inbox_messages.body_text** |
| Card preview | `src/modules/inbox/components/InboxConversationList.tsx`: `conversation.last_message_preview` | **inbox_conversations.last_message_preview** |

**DB tables:**  
- **inbox_messages:** `id`, `user_id`, `gmail_connection_id`, `conversation_id`, `channel`, `body_text`, `sent_at`, `meta` (JSONB with `gmail.messageId`, `gmail.threadId`).  
- **inbox_conversations:** `id`, `last_message_at`, `last_message_preview`, …

---

## 3. Safest fix approach: Option A vs B vs C

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A** | One-time backfill script/migration/job to refresh old Gmail message `body_text` | Clear scope; no change to normal sync; can target known-bad or time window | Requires running a separate job; does not fix future “duplicate skip” semantics |
| **B** | Modify Gmail sync duplicate handling to optionally refresh `body_text` for existing rows | Future re-syncs gradually fix old rows; no separate job | Touches hot path; risk of overwriting user edits if we ever allow edits; more complex |
| **C** | Both A and B | Fixes history now and keeps sync able to refresh | Most work; B may be unnecessary if extraction is fixed and backfill is run once |

**Recommendation:** **Option A** as the **minimal safe path**: implement a **targeted backfill** (Edge Function or script) that re-fetches Gmail content for eligible rows and updates only `body_text` (and `last_message_preview` when the message is the latest in its conversation). Do **not** change duplicate handling in gmail-sync-now for now; that keeps sync behavior predictable and avoids regressions. Option B can be added later if we want “refresh on re-sync” as a product behavior.

---

## 4. Recommended minimal implementation path

1. **Add a backfill Edge Function** (e.g. `gmail-refresh-body` or `inbox-gmail-refresh-bodies`) that:
   - Is invoked with optional scope (e.g. `user_id`, or `conversation_id`, or “all email messages for user”).
   - Loads eligible **inbox_messages** rows (channel = `email`, `meta->gmail->messageId` present; optionally filter by `created_at` or a list of message IDs).
   - Groups by `user_id` / `gmail_connection_id`, obtains a valid Gmail access token (refresh if needed).
   - For each message row: fetches the Gmail message by ID (`format=full`), runs the **same** `extractBodyText` logic (or shared helper), then:
     - `UPDATE inbox_messages SET body_text = $newBody WHERE id = $messageId`.
     - If this message is the **latest** in its conversation (e.g. `sent_at` equals or is the max for that `conversation_id`), also `UPDATE inbox_conversations SET last_message_preview = left($newBody, 120) WHERE id = $conversationId`.
   - Returns counts (processed, updated, errors).
2. **Reuse extraction logic** so backfill uses the same body extraction as gmail-sync-now (shared `extractBodyText` in `_shared` or copy). If we later add HTML fallback / charset handling in gmail-sync-now, use the same in the backfill.
3. **Do not** change gmail-sync-now duplicate handling in this phase.
4. **Optional:** Add a small UI or admin path to trigger the backfill for the current user (e.g. “Refresh message bodies” in Inbox settings) or run it once via Supabase Dashboard / CLI for all users.

---

## 5. How to identify which rows are eligible for refresh

- **Minimum:** `inbox_messages.channel = 'email'` and `inbox_messages.meta->gmail->messageId` is not null. These are Gmail-synced messages we can re-fetch.
- **Optional filters:**
  - **By user:** `user_id = $userId` (for per-user backfill).
  - **By conversation:** `conversation_id = $conversationId` (for single-thread refresh).
  - **By time:** `created_at < $cutoff` to refresh only “historical” rows (e.g. before decoding fix).
  - **By message IDs:** explicit list of `inbox_messages.id` or `meta->gmail->messageId` for a targeted fix.
- **Eligibility query example (per user):**
  - `SELECT id, conversation_id, sent_at, meta FROM inbox_messages WHERE user_id = $userId AND channel = 'email' AND meta->'gmail'->>'messageId' IS NOT NULL ORDER BY conversation_id, sent_at`.

---

## 6. How to safely re-fetch Gmail message content and update only body_text

1. **Resolve Gmail connection:** From `inbox_messages` we have `user_id` and `gmail_connection_id`. Load the connection row; get or refresh the access token (same flow as gmail-sync-now).
2. **Fetch from Gmail:** `GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{messageId}?format=full` with `Authorization: Bearer {accessToken}`. Use `meta->gmail->messageId` from the row.
3. **Extract body:** Run the same `extractBodyText(payload)` logic used in gmail-sync-now (prefer shared module so one place to improve decoding). Fallback: `message.snippet` if extraction returns empty.
4. **Update DB:**  
   - `UPDATE inbox_messages SET body_text = $newBody WHERE id = $inboxMessageId` (only `body_text`; do not change `sent_at`, `meta`, etc.).  
   - If this message is the latest in its conversation (see below), also update `inbox_conversations.last_message_preview` for that conversation.
5. **Rate / errors:** Use the same Gmail API quotas as sync; on 404/410, log and skip (message deleted in Gmail). Do not overwrite with empty unless we explicitly decide to.

**Determining “latest message” per conversation:** For a given `conversation_id`, the latest message is the one with max `sent_at` in `inbox_messages` for that conversation. When we refresh a message, after updating its `body_text`, check whether this message’s `sent_at` is the max for its `conversation_id`; if yes, set `inbox_conversations.last_message_preview = left(newBody, 120)` for that conversation.

---

## 7. Whether last_message_preview should be recalculated during backfill

**Yes.** When we update an **inbox_messages** row’s `body_text`, if that message is the **latest** in its conversation (by `sent_at`), we should also update **inbox_conversations.last_message_preview** to the new body slice (`left(newBody, 120)`). That keeps the card preview and the thread body in sync and avoids the “preview correct, body wrong” state for that conversation. For messages that are **not** the latest, we only update `inbox_messages.body_text`; no need to touch `last_message_preview` because the preview is driven by the latest message.

---

## 8. Regression checklist

- [ ] **Old corrupted Georgian message:** After backfill for that message (or its conversation), thread view shows correct Georgian in the body; card preview unchanged or updated if that message was the latest.
- [ ] **New Gmail message sync:** gmail-sync-now still inserts new messages as before; duplicate detection still skips existing rows; no unintended updates to existing rows from normal sync.
- [ ] **Existing non-Gmail messages:** No backfill logic runs for SMS/WhatsApp; `inbox_messages` rows with `channel != 'email'` are untouched.
- [ ] **Thread view corrected after refresh:** Refreshed email messages show correct body_text in ConversationThread; if the refreshed message is the latest, the conversation card’s last_message_preview matches.
- [ ] **Gmail API / token:** Backfill uses the same token refresh and error handling as gmail-sync-now; no new security exposure (service role for DB; user-scoped Gmail token).
- [ ] **Idempotency:** Running the backfill twice for the same set of rows is safe (same body_text written again).
