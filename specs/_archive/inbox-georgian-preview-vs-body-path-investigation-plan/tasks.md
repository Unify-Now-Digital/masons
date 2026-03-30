# Tasks: Fix Stale Historical Gmail body_text (Backfill)

**Branch:** feature/inbox-georgian-preview-vs-body-path-investigation  
**Plan:** [plan.md](./plan.md)

---

## Task 1 — Shared body extraction (optional but recommended)

- [x] **Goal:** Reuse the same body extraction in backfill and gmail-sync-now so fixes (e.g. HTML fallback, charset) apply in both.
- [x] **Option A:** Move `extractBodyText` (and any payload types) to `supabase/functions/_shared/gmailBody.ts` (or similar); import in `gmail-sync-now/index.ts` and in the new backfill function.
- [ ] **Option B:** Copy the current `extractBodyText` into the backfill function and keep gmail-sync-now as-is (faster, but two places to update later).
- [x] **Recommendation:** Option A if we expect further extraction improvements; otherwise Option B for minimal change.

---

## Task 2 — Backfill Edge Function

- [x] **Create:** `supabase/functions/gmail-refresh-body/index.ts` (or `inbox-gmail-refresh-bodies`).
- [x] **Input:** Optional query/body params: `user_id` (default: request user), `conversation_id` (optional), `limit` (optional), `created_before` ISO date (optional), `message_id` (optional Gmail message ID).
- [x] **Flow:**
  1. Resolve authenticated user and optional filters.
  2. Query eligible rows: `inbox_messages` where `channel = 'email'`, `meta->gmail->messageId` not null, and optional filters. Order by conversation_id, sent_at.
  3. Group by `user_id` / `gmail_connection_id`; for each user, load `gmail_connections` and obtain valid access token (refresh if needed).
  4. For each message row: get `messageId` from `meta.gmail.messageId`; fetch Gmail message `format=full`; run `extractBodyText(payload)`; if empty use `message.snippet`.
  5. `UPDATE inbox_messages SET body_text = $newBody WHERE id = $id`.
  6. If this message is the latest in its conversation (max sent_at for that conversation_id), `UPDATE inbox_conversations SET last_message_preview = left($newBody, 120) WHERE id = $conversation_id`.
  7. Return counts: processed, updated, errors (and optional list of failed message IDs).
- [x] **Auth:** Use same pattern as gmail-sync-now (user-scoped; service role for DB).
- [x] **Errors:** On Gmail 404/410 or fetch failure, log and skip; do not overwrite body_text with empty unless intended.

---

## Task 3 — Eligibility query and “latest message” check

- [x] **Eligibility:** `SELECT id, conversation_id, sent_at, body_text, meta FROM inbox_messages WHERE user_id = $1 AND channel = 'email' AND (meta->'gmail'->>'messageId') IS NOT NULL` plus optional `AND conversation_id = $2`, `AND created_at < $3`, `LIMIT $4`.
- [x] **Latest per conversation:** For each conversation_id in the batch, determine the max sent_at among its messages (from the same result set or a small follow-up query). When updating a message, if its sent_at equals that max for its conversation_id, also update `inbox_conversations.last_message_preview`.

---

## Task 4 — Do not change gmail-sync-now duplicate behavior

- [x] **Verify:** gmail-sync-now still does `if (duplicate) continue;` with no UPDATE to existing rows. No code change in this task unless we moved `extractBodyText` to _shared (then only import path changes).

---

## Task 5 — Regression checks

- [ ] **Old corrupted Georgian message:** Run backfill for that user/conversation; open thread; body shows correct Georgian; card preview correct if that message is latest.
- [ ] **New Gmail sync:** Sync new email; new row inserted; sync again same thread; no duplicate insert; existing rows unchanged by sync.
- [ ] **Non-Gmail:** Backfill only selects `channel = 'email'`; SMS/WhatsApp rows untouched.
- [ ] **Thread after refresh:** Refreshed messages show new body_text in ConversationThread; latest message’s conversation has matching last_message_preview.
- [ ] **Idempotency:** Run backfill twice; same result; no errors.
