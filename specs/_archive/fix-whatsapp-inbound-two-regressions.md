# Fix Two WhatsApp Inbox Regressions — Analysis and Change List

## Overview

This spec analyses **two remaining WhatsApp inbox regressions** after the connection-lookup normalization fix: (1) customer-first inbound WhatsApp messages still do not appear when no conversation exists; (2) inbound WhatsApp replies do appear for existing conversations but those conversations do not move to the top of the Inbox list. The document inspects the full inbound flow in `twilio-sms-webhook`, compares with frontend/API sort and realtime behavior, identifies exact root causes, and lists the exact change list. **No implementation in this phase.**

**Context:**
- Connection lookup was updated to use normalized comparison; symptoms persist.
- Webhook is at least partially working (replies to existing conversations appear).
- Message insert appears to succeed for existing conversations; new-conversation creation and/or conversation metadata update may be failing or incomplete.

**Goal:**
- Identify exact root causes for both symptoms.
- Produce a precise, implementation-ready change list.

---

## Current State Analysis

### 1. Connection lookup

- **File:** `supabase/functions/twilio-sms-webhook/index.ts` (lines 76–118).
- For WhatsApp: fetches all `whatsapp_connections` for `twilio_account_sid` and `status = 'connected'`, then in code finds the row where `normalizeHandle(c.whatsapp_from) === normalizeHandle(rawTo)`.
- **Potential issue:** `normalizeHandle` uses `.replace(/^whatsapp:/, '')` — **case-sensitive**. If Twilio sends `To: WhatsApp:+44...` or `To: WHATSAPP:+44...`, the prefix is not stripped, so normalized Twilio To would still contain "WhatsApp:" and would not match stored `whatsapp:+44...` after normalization. So connection could still fail for some providers/formats.
- If no connection is found, webhook returns 200 without creating conversation or message (symptom 1).

### 2. Channel and handle normalization

- `normalizeHandle(h) = (h ?? '').trim().replace(/^whatsapp:/, '')` — case-sensitive prefix strip.
- `detectChannel` uses `startsWith('whatsapp:')` — case-sensitive. So channel is still detected as whatsapp only for lowercase prefix.
- `primary_handle = from.trim()` (normalized customer number); conversation lookup and insert use this. No change needed for conversation identity if connection and insert succeed.

### 3. Existing conversation lookup query

- Query: `inbox_conversations` where `channel`, `primary_handle`, `status = 'open'`, `user_id = ownerUserId`, limit 1.
- Uses normalized `primaryHandle` (customer number). Correct.
- **Note:** Webhook uses Supabase client created with `SUPABASE_SERVICE_ROLE_KEY`. In Supabase, the service role **bypasses RLS**, so the query sees all rows. No RLS issue on SELECT for the webhook.

### 4. New conversation insert branch

- Insert payload: `channel`, `primary_handle`, `external_thread_id`, `subject`, `status`, `unread_count`, `last_message_at`, `last_message_preview`, `updated_at`, `user_id`.
- **Critical:** RLS on `inbox_conversations`: INSERT policy is `with check (user_id = (select auth.uid()))` for role **authenticated**. When the Edge Function runs, it uses the **service role** client. With the service role key, RLS is **by default bypassed** in Supabase, so the insert should succeed. If for any reason the project uses a custom configuration or the webhook does not use the service role key (e.g. env var missing and fallback to anon), then `auth.uid()` would be null and the insert would fail (WITH CHECK would fail). So **verify in deployment** that the webhook uses the service role key and that RLS is bypassed for that client.
- **Import path:** The webhook currently has `import { attemptAutoLink } from './autoLinkConversation.ts';`. The shared module lives at `_shared/autoLinkConversation.ts`. If `./autoLinkConversation.ts` does not exist in the function directory, the function can **fail to load** at cold start (missing module). In that case the entire handler may not run or may throw when calling `attemptAutoLink`, and Twilio would receive 500 or the function would not process the request. So **wrong import path can prevent any logic from running**, including connection lookup and insert. Fix: use `'../_shared/autoLinkConversation.ts'`.

### 5. Message insert branch

- Inserts `inbox_messages` with `conversation_id`, `channel`, `from_handle`, `to_handle`, `body_text`, `sent_at`, `status`, `external_message_id`, `meta`, `user_id`, and optionally `whatsapp_connection_id`.
- On error, we log and return 200. So if insert fails, we’d see a log but no message in Inbox. For **existing** conversations, the user says replies DO appear, so message insert is succeeding in that path. So the failure path for customer-first is likely **before** message insert (connection not found or new conversation insert failed).

### 6. Parent conversation update payload

- **When:** After message insert (lines 216–229).
- **Payload:** `last_message_at: sentAt`, `last_message_preview: preview`, `updated_at: sentAt`; if `existingConv` then also `unread_count: (existingConv.unread_count ?? 0) + 1`.
- **Status:** Not updated (still `'open'` from initial state). No change needed for status.
- **Critical:** The webhook does **not** check the result of this update. The call is:
  `await supabase.from('inbox_conversations').update(updatePayload).eq('id', conversationId);`
  There is no `const { data, error } = ...` and no log on error or zero rows. So if the update **fails** (e.g. permission, trigger, or constraint) or updates **zero rows** (e.g. wrong id, or RLS preventing the update in a non–service-role context), the code would still continue and return 200. So **symptom 2** (conversation not moving to top) is consistent with the conversation update **silently failing or affecting 0 rows**: `last_message_at` would not change, so the list (sorted by `last_message_at DESC`) would not reorder.

### 7. Order of operations

- Order is: message insert → conversation update → attemptAutoLink → return. So the conversation update runs **after** message insert. Correct. If the update were before the message insert, we’d still want to update again after so that `last_message_at` matches the latest message; current order is correct.

### 8. Ignored errors

- **Conversation update:** Result of the update is not captured; errors are ignored. So we cannot tell if the update failed or updated 0 rows.
- **Existing-conv user_id update (lines 152–156):** When `existingConv` exists but `!existingConv.user_id`, we do an update; that result is also not captured. Minor; the main issue is the post–message-insert conversation update.

### 9. Frontend/API sort and dependency

- **API:** `src/modules/inbox/api/inboxConversations.api.ts` — `fetchConversations` orders by `last_message_at` DESC (nulls last), then `created_at` DESC (lines 45–47). So the list is sorted by **last_message_at**.
- **Webhook:** It sets `last_message_at: sentAt` and `updated_at: sentAt` in the conversation update. So the webhook **does** update the field the UI sort depends on. If that update does not persist, the conversation will not move to the top.

### 10. Realtime and list refresh

- **UnifiedInboxPage:** Subscribes to `inbox_messages` INSERT and `inbox_conversations` UPDATE; on event, adds conversation id to a set and debounces; then sets state that triggers a refetch of the conversations list. So when the webhook (1) inserts a message, INSERT fires → refetch; when the webhook (2) updates the conversation, UPDATE fires → refetch. So **if** the conversation update is written to the DB, the UI should refetch and the list should reorder by `last_message_at`. So **symptom 2** is explained if the conversation update never persists (silent failure or 0 rows updated).

### Comparison: manually created vs inbound-created vs inbound-updated

- **Manually created (New Conversation):** Row has `channel`, `primary_handle` (normalized), `user_id`, `status = 'open'`, `last_message_at` (often null until first message), `updated_at`. Insert is done from the **browser** with authenticated user, so `auth.uid()` = user_id and RLS allows insert.
- **Inbound-created (new conversation by webhook):** Same shape; `user_id: ownerUserId`, `last_message_at: sentAt`, `updated_at: sentAt`. Insert is done from Edge Function with **service role**; RLS is bypassed, so insert should succeed unless env is wrong or a trigger/constraint fails.
- **Inbound-updated (existing conversation):** Webhook updates `last_message_at`, `last_message_preview`, `updated_at`, and optionally `unread_count`. No error handling; if update fails or affects 0 rows, the row does not change and the list does not reorder.

---

## Root Causes

### Symptom 1: Customer-first inbound WhatsApp messages do not appear

**Likely root causes (in order of likelihood):**

1. **Wrong import path for shared auto-link**  
   `import { attemptAutoLink } from './autoLinkConversation.ts';` points to a file that does not exist in the function folder (shared code is in `_shared/`). If the runtime resolves this at cold start, the function can throw or fail to load, so the whole handler may not run or may error before creating a conversation. **Fix:** Use `'../_shared/autoLinkConversation.ts'`.

2. **Connection lookup still failing (case-sensitive prefix)**  
   `normalizeHandle` only strips the literal `whatsapp:` (case-sensitive). If Twilio or the provider sends `To: WhatsApp:+44...` or `To: WHATSAPP:+44...`, the prefix is not removed, so the normalized Twilio value would not match the stored `whatsapp:+44...` (normalized to `+44...`). So no connection is found and the webhook returns 200 without creating a conversation or message. **Fix:** Normalize the prefix in a case-insensitive way (e.g. `replace(/^whatsapp:/i, '')`).

3. **New conversation insert failing (if not using service role or RLS not bypassed)**  
   If the Edge Function does not use the service role key (e.g. env var missing), or if RLS is not bypassed for the client, then INSERT would be subject to `with check (user_id = auth.uid())`. With `auth.uid()` null in the function context, the insert would be rejected. **Mitigation:** Verify `SUPABASE_SERVICE_ROLE_KEY` is set for the webhook and that the client is created with it; optionally log (without secrets) when conversation insert fails and surface the error code.

### Symptom 2: Conversations do not move to the top after receiving a reply

**Root cause:**

- **Conversation update result is ignored.**  
  The webhook updates `inbox_conversations` (last_message_at, last_message_preview, updated_at, unread_count) but does not capture or check the update result. If the update fails or affects 0 rows (e.g. wrong conversationId, or in a non–service-role scenario RLS blocking the update), `last_message_at` would not change. The API and UI sort by `last_message_at DESC`, so the conversation would not move to the top. Realtime would still fire on `inbox_messages` INSERT and trigger a refetch, but the refetched list would have the same order because the conversation row was never updated. **Fix:** Capture the update result; log and optionally surface an error when the update fails or returns 0 rows.

---

## Exact Change List

1. **Fix shared helper import (symptom 1)**  
   **File:** `supabase/functions/twilio-sms-webhook/index.ts`  
   - Change: `import { attemptAutoLink } from './autoLinkConversation.ts';`  
   - To: `import { attemptAutoLink } from '../_shared/autoLinkConversation.ts';`

2. **Normalize WhatsApp prefix case-insensitively (symptom 1)**  
   **File:** `supabase/functions/twilio-sms-webhook/index.ts`  
   - In `normalizeHandle`, change: `.replace(/^whatsapp:/, '')`  
   - To: `.replace(/^whatsapp:/i, '')`  
   - So that `WhatsApp:+44...` and `WHATSAPP:+44...` are normalized the same as `whatsapp:+44...`.

3. **Check and log conversation update result (symptom 2)**  
   **File:** `supabase/functions/twilio-sms-webhook/index.ts`  
   - Replace the fire-and-forget conversation update with:
     - `const { data: updated, error: updateErr } = await supabase.from('inbox_conversations').update(updatePayload).eq('id', conversationId).select('id').maybeSingle();`
     - If `updateErr` or no row updated, log a warning (e.g. "twilio-sms-webhook: conversation update failed or 0 rows", conversationId, updateErr?.message). Do not log full payload or credentials.

4. **Optional: Log when new conversation insert fails (symptom 1)**  
   - When `createErr || !newConv`, in addition to the existing log, log the error code/message (e.g. `createErr?.code`, `createErr?.message`) so that RLS or constraint failures can be distinguished.

5. **No frontend or schema changes** for these two symptoms; all changes are in `twilio-sms-webhook/index.ts`.

---

## What NOT to Do

- Do not change conversation identity (channel, primary_handle) or the existing conversation lookup query.
- Do not change the order of operations (message insert then conversation update).
- Do not add frontend or DB schema changes unless a follow-up investigation shows they are required.

---

## Open Questions / Considerations

- In production/staging, confirm whether the webhook is invoked for customer-first messages and what the logs show (connection matched? conversation insert error? update error?). That will validate which of the root causes applies.
- If after the above fixes symptom 1 persists, verify that the Edge Function is using the service role key and that RLS is bypassed for inserts/updates from that client; if not, consider a SECURITY DEFINER function or app context for webhook-created rows.
