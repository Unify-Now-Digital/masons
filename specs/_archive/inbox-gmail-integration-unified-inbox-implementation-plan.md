# Implementation Plan: Gmail Integration (Manual Sync + Reply) for Unified Inbox

## Feature Overview

Add manual Gmail email sync and outbound replies to the Unified Inbox using Supabase Edge Functions, reusing existing `inbox_conversations` and `inbox_messages` tables. No schema changes; channel `'email'` uses Gmail, while `'sms'/'whatsapp'` continue using Twilio. Inbound sync is **manual**, single shared mailbox, text-only (no attachments).

**Branch:** `feature/inbox-gmail-integration-unified-inbox`  
**Spec File:** `specs/inbox-gmail-integration-unified-inbox.md`

---

## Phase A — Secrets & Configuration

### A.1 Supabase Edge Function Secrets

**Supabase project secrets (set via `supabase secrets set`):**
- `GMAIL_CLIENT_ID`  
  - OAuth 2.0 Client ID for the shared Gmail project (Web or Installed application).
- `GMAIL_CLIENT_SECRET`  
  - OAuth 2.0 Client Secret.
- `GMAIL_REFRESH_TOKEN`  
  - Long-lived refresh token for the shared mailbox user.
- `GMAIL_USER_EMAIL`  
  - The shared Gmail address (e.g. `inbox@workshop.co.uk`).
- `SUPABASE_URL`  
  - Already present; used by edge functions to create Supabase client.
- `SUPABASE_SERVICE_ROLE_KEY`  
  - Already present; used for full DB access (bypasses RLS within edge functions).
- `INBOX_ADMIN_TOKEN`  
  - Shared secret used to protect all inbox-related edge functions (`inbox-twilio-send`, `inbox-gmail-sync`, `inbox-gmail-send`).

**Action Items:**
1. Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` already set (used by existing functions).
2. Add Gmail-specific secrets via `supabase secrets set`:
   - `GMAIL_CLIENT_ID`
   - `GMAIL_CLIENT_SECRET`
   - `GMAIL_REFRESH_TOKEN`
   - `GMAIL_USER_EMAIL`
3. Ensure `INBOX_ADMIN_TOKEN` remains consistent with frontend `VITE_INBOX_ADMIN_TOKEN`.

### A.2 Frontend Environment Variables

**Existing Vite env vars (reused):**
- `VITE_SUPABASE_FUNCTIONS_URL`  
  - Example: `https://<PROJECT_REF>.supabase.co/functions/v1`
- `VITE_INBOX_ADMIN_TOKEN`  
  - Must match `INBOX_ADMIN_TOKEN` secret.

**Files to update:**
- `.env.example`  
  - Ensure the following are present with comments:
    ```bash
    VITE_SUPABASE_FUNCTIONS_URL=https://<PROJECT_REF>.supabase.co/functions/v1
    VITE_INBOX_ADMIN_TOKEN=your-inbox-admin-token
    ```
- `.env` (local dev)  
  - Set actual values for `VITE_SUPABASE_FUNCTIONS_URL` and `VITE_INBOX_ADMIN_TOKEN`.

**Important:**  
After editing `.env` or `.env.example`, **restart the Vite dev server** so `import.meta.env` picks up changes.

---

## Phase B — Edge Function: `inbox-gmail-sync`

**File:** `supabase/functions/inbox-gmail-sync/index.ts` (new)

### B.1 Function Shell & CORS

**Tasks:**
1. Create `index.ts` in `supabase/functions/inbox-gmail-sync/`.
2. Use `Deno.serve` as entry point.
3. Define CORS headers similar to `inbox-twilio-send`:
   ```ts
   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Methods': 'POST, OPTIONS',
     'Access-Control-Allow-Headers':
       'authorization, apikey, content-type, x-client-info, x-admin-token',
   };
   ```
4. Handle `OPTIONS` requests:
   - Return `200` with `corsHeaders`.
5. Reject non-`POST` (other than `OPTIONS`) with `405 Method Not Allowed`.

### B.2 Admin Token Check

**Tasks:**
1. Read `X-Admin-Token` (case-insensitive) from headers:
   ```ts
   const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
   const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');
   ```
2. If token missing or mismatch:
   - Return `401 Unauthorized` with JSON `{ error: 'Unauthorized' }` and `corsHeaders`.
3. JWT is effectively **OFF** for this function; we rely solely on this shared secret.

### B.3 Gmail Auth (Refresh Token Flow)

**Tasks:**
1. Load required env vars:
   - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL`.
2. Validate presence; return `500` with generic error if missing and log a safe message.
3. Implement token exchange:
   - `POST https://oauth2.googleapis.com/token`
   - Body: `grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`.
   - Parse JSON for `access_token`; handle non-200 with safe logging (status, not full body).

### B.4 Fetch Strategy (V1: Recent Messages)

**Tasks:**
1. Parse optional request body:
   ```ts
   interface SyncRequest {
     since?: string; // ISO timestamp
     maxMessages?: number; // default 50, max 100
   }
   ```
2. Build Gmail `users.messages.list` call:
   - URL: `https://gmail.googleapis.com/gmail/v1/users/me/messages`
   - Query:
     - `labelIds=INBOX`
     - `maxResults = maxMessages || 50` (clamp between 1 and 100)
     - `q` built as:
       - if `since` provided: `q = 'newer_than:7d after:<date>'` or use strictly `after:<unix>`; simplest v1: `q = ''` (rely on `maxResults`), optional improvement later.
3. For each returned message `id`:
   - Call `users.messages.get` with:
     - `format=full`
     - `id=<messageId>`

### B.5 Parsing Gmail Messages

**Tasks:**
1. From `messages.get` response:
   - Extract:
     - `threadId`
     - `id` (Gmail `messageId`)
     - `payload.headers`:
       - `Date`
       - `From`
       - `To`
       - `Subject`
       - `Message-ID` (optional; many Gmail APIs supply it via `id`, but header can differ)
     - `snippet` (short text preview)
     - `payload.parts` and/or `payload.body` for body content.
2. Parse email addresses:
   - Use simple regex to extract email from `From`/`To` (e.g., `"Name <email@example.com>"`).
3. Determine `sentAt`:
   - Try parsing Date header using `new Date(dateHeader)`.
   - If invalid, fallback to `internalDate` (ms since epoch, convert to ISO).
   - As final fallback, `new Date().toISOString()`.
4. Determine `bodyText`:
   - Prefer `text/plain` part.
   - If only `text/html`, strip basic HTML tags or fallback to snippet.
   - If nothing available, fallback to snippet.
5. Determine direction:
   - If `fromEmail === GMAIL_USER_EMAIL` → `direction='outbound'`.
   - Else → `direction='inbound'`.
6. Determine `primary_handle`:
   - For inbound: primary handle = `fromEmail`.
   - For outbound: primary handle = `toEmail` (customer).
7. Subject:
   - Use subject header; if missing, set to `'(no subject)'`.

### B.6 DB Writes: Conversations & Messages

**Supabase client:**
- Use `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` with `@supabase/supabase-js` inside the function.

**Upsert strategy for conversations (thread-based):**
1. Define a deterministic mapping:
   - One `inbox_conversations` per `gmail.threadId`.
2. Since no schema changes allowed, rely on messages’ meta:
   - Query `inbox_messages` for existing message with `meta.gmail.threadId = threadId`.
   - If found:
     - Use its `conversation_id` for all messages in this thread.
   - If not found:
     - Insert new `inbox_conversations` row:
       - `channel = 'email'`
       - `primary_handle = primary_handle`
       - `subject = subject`
       - `status = 'open'`
       - `unread_count = direction === 'inbound' ? 1 : 0`
       - `last_message_at = sentAt`
       - `last_message_preview = bodyText.slice(0, 120)`
3. Deduping for conversation on re-sync:
   - Because we always search messages for `meta.gmail.threadId`, repeated syncs for same thread will reuse the same conversation.

**Insert messages:**
1. Dedup check:
   - Before insert, query `inbox_messages`:
     - filter: `channel='email'` and `meta->'gmail'->>'messageId' = <gmailMessageId>`
   - If a row exists → **skip insert** for this Gmail message.
2. Insert new message:
   ```ts
   await supabase.from('inbox_messages').insert({
     conversation_id,
     channel: 'email',
     direction,
     from_handle: fromEmail,
     to_handle: toEmail,
     body_text: bodyText,
     subject,
     sent_at: sentAt,
     status: 'sent', // generic delivered state
     meta: {
       gmail: {
         messageId: gmailMessageId,
         threadId: gmailThreadId,
       },
     },
   });
   ```
3. Update conversation metadata:
   - For each processed message:
     - `last_message_at = GREATEST(existing_last_message_at, sentAt)`
     - `last_message_preview = bodyText.slice(0, 120)` when `sentAt` is the latest.
   - For inbound messages only:
     - `unread_count = unread_count + 1` when `status='open'` (simple v1 rule).

### B.7 Deduping Strategy Details

- Primary dedupe: check by `meta.gmail.messageId` before inserting messages.
- Secondary dedupe: `threadId`-based conversation reuse ensures no duplicate conversations per thread.
- Idempotent behavior: running sync multiple times should not duplicate messages.

---

## Phase C — Edge Function: `inbox-gmail-send`

**File:** `supabase/functions/inbox-gmail-send/index.ts` (new)

### C.1 Function Shell & Security

**Tasks:**
1. Similar CORS + `OPTIONS` pattern as `inbox-gmail-sync`.
2. Require `POST`; return `405` for others.
3. Validate `X-Admin-Token` against `INBOX_ADMIN_TOKEN`.

### C.2 Load Conversation & Last Gmail Metadata

**Tasks:**
1. Parse request body:
   ```ts
   interface SendReplyRequest {
     conversation_id: string;
     body_text: string;
   }
   ```
2. Validate non-empty `conversation_id` and trimmed `body_text`.
3. Fetch conversation:
   - From `inbox_conversations` by `id`.
   - Ensure `channel='email'`; if not, return `400`.
4. Fetch latest Gmail-based message:
   - Query `inbox_messages`:
     - `conversation_id = conversation_id`
     - `channel = 'email'`
     - `meta->'gmail'->>'threadId' IS NOT NULL`
   - Order by `sent_at DESC` and take first.
   - Extract:
     - `threadId = meta.gmail.threadId`
     - `messageId = meta.gmail.messageId` (if present).
5. If no Gmail metadata found:
   - Option for v1: return `400` with error `No Gmail thread for this conversation`.

### C.3 Gmail Auth & RFC 2822 Email

**Tasks:**
1. Obtain access token using same refresh token flow as `inbox-gmail-sync`.
2. Build email:
   - `From: GMAIL_USER_EMAIL`
   - `To: conversation.primary_handle` (customer email).
   - `Subject:` 
     - If conversation.subject starts with `Re:`/`RE:` → use as is.
     - Else: `Re: ${conversation.subject}`.
   - Headers:
     - `In-Reply-To: <messageId>` if available.
     - `References: <messageId>` if available.
   - Body: plain `body_text.trim()` (no HTML).
3. Base64URL encode full RFC 2822 message.
4. Call Gmail send API:
   - `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
   - Body:
     ```json
     {
       "raw": "<base64url>",
       "threadId": "<gmailThreadId>"
     }
     ```

### C.4 DB Writes & Response

**On success:**
1. Parse Gmail response:
   - `id` (new Gmail messageId)
   - `threadId` (should match existing).
2. Insert outbound `inbox_messages` row:
   - `conversation_id`
   - `channel='email'`
   - `direction='outbound'`
   - `from_handle = GMAIL_USER_EMAIL`
   - `to_handle = conversation.primary_handle`
   - `body_text = trimmed body_text`
   - `subject = derived subject`
   - `sent_at = now()`
   - `status = 'sent'`
   - `meta.gmail.messageId = response.id`
   - `meta.gmail.threadId = response.threadId`
3. Update conversation:
   - `last_message_at = now()`
   - `last_message_preview = trimmed body_text.slice(0, 120)`
   - Do **not** change `unread_count`.
4. Return:
   ```json
   {
     "success": true,
     "gmailMessageId": "...",
     "gmailThreadId": "..."
   }
   ```

**On failure:**
1. Log safe details: status, statusText, maybe error summary (no tokens).
2. Return `500` with JSON `{ error: "Failed to send Gmail reply" }`.

---

## Phase D — Frontend Changes

### D.1 API Helpers

**File:** `src/modules/inbox/api/inboxGmail.api.ts` (new)

**Functions:**
1. `syncGmail(options?: { since?: string; maxMessages?: number })`
   - Endpoint: `${VITE_SUPABASE_FUNCTIONS_URL}/inbox-gmail-sync`
   - Method: `POST`
   - Headers:
     - `Content-Type: application/json`
     - `X-Admin-Token: VITE_INBOX_ADMIN_TOKEN`
   - Body: `options` or `{}`.
   - Returns summary:
     ```ts
     interface SyncGmailResult {
       syncedCount: number;
       skippedCount: number;
       errorsCount: number;
     }
     ```
   - Throws if non-200 or `error` present.

2. `sendGmailReply({ conversationId, bodyText })`
   - Endpoint: `${VITE_SUPABASE_FUNCTIONS_URL}/inbox-gmail-send`
   - Method: `POST`
   - Headers: same as above.
   - Body: `{ conversation_id: conversationId, body_text: bodyText }`.
   - Returns typed success response or throws on error.

### D.2 Hooks

**File:** `src/modules/inbox/hooks/useInboxMessages.ts`

**Goal:** Route send reply to Gmail vs Twilio by channel.

**Tasks:**
1. Adjust `useSendReply` mutation input type to accept `channel`:
   ```ts
   mutationFn: async ({ conversationId, bodyText, channel }: { conversationId: string; bodyText: string; channel: 'email' | 'sms' | 'whatsapp' }) => { ... }
   ```
2. Routing logic:
   ```ts
   if (channel === 'email') {
     await sendGmailReply({ conversationId, bodyText: trimmedBodyText });
   } else {
     await sendTwilioMessage({ conversation_id: conversationId, body_text: trimmedBodyText });
   }
   ```
3. Ensure cache invalidation remains:
   - `inboxKeys.messages.byConversation(conversationId)`
   - `inboxKeys.conversations.all`
   - `inboxKeys.conversations.detail(conversationId)`

**File:** `src/modules/inbox/hooks/useInboxConversations.ts`

- No major changes besides potential helper for `useSyncGmail`:
  - `useSyncGmail` mutation:
    - Calls `syncGmail()`.
    - On success, invalidates `inboxKeys.conversations.all`.

### D.3 UI: “Sync Email” Button

**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Tasks:**
1. Import `useSyncGmail` hook.
2. Add a small button near Archive/Mark as Read:
   ```tsx
   <Button
     variant="outline"
     size="sm"
     onClick={handleSyncEmail}
     disabled={syncGmailMutation.isPending}
   >
     {syncGmailMutation.isPending ? 'Syncing…' : 'Sync Email'}
   </Button>
   ```
3. `handleSyncEmail`:
   - Calls `syncGmailMutation.mutate()`.
   - Optionally restrict to when Email tab is active (or always allowed; spec allows either).
4. Layout:
   - Use same flex container as existing buttons; do not change grid or structure.

### D.4 UI: Send Reply Channel Routing

**File:** `src/modules/inbox/components/ConversationView.tsx`

**Tasks:**
1. When calling `sendReplyMutation.mutate`, include `channel`:
   ```ts
   sendReplyMutation.mutate(
     { conversationId, bodyText: replyText, channel: conversation.channel as any },
     { ... }
   );
   ```
2. Keep existing behavior:
   - Disable send while pending.
   - Clear textarea on success.
   - Show inline error message on failure (already implemented).

---

## Phase E — Manual Test Checklist

### E.1 Sync Behavior

1. Configure Gmail secrets and admin token.
2. Start app, navigate to Unified Inbox.
3. Click “Sync Email”.
4. Verify:
   - New email conversations (`channel='email'`) appear in the left-hand list.
   - Each conversation shows:
     - Primary handle = customer email.
     - Subject (or “(no subject)”).
     - Last message preview/time matches latest Gmail message.
   - Unread badge (`unread_count`) increments for new inbound emails.

### E.2 Conversation Thread

1. Click an email conversation.
2. Verify:
   - Messages from Gmail thread appear chronologically.
   - Inbound vs outbound styling is correct.
   - Timestamps are reasonable (no “Invalid date”).

### E.3 Send Reply (Email)

1. Open an email conversation.
2. Type a reply and click “Send Reply”.
3. Verify:
   - Send button disables and shows “Sending…” while pending.
   - On success, textarea clears.
   - New outbound message appears in the thread.
   - Conversation list preview/time updates.
   - In Gmail UI:
     - Reply appears in same thread.
     - From address = shared mailbox.

### E.4 Re-Sync Idempotency

1. After syncing and viewing a conversation, click “Sync Email” again.
2. Verify:
   - No duplicate messages in the thread.
   - `unread_count` does not spike artificially (inbound messages not re-counted).

### E.5 Channel Routing

1. For SMS/WhatsApp conversations, send a reply.
2. Verify:
   - Twilio path still used.
   - Email path only used when `channel='email'`.

### E.6 Build & Stability

1. Run `npx tsc --noEmit` and `npm run build`.
2. Verify:
   - No TypeScript errors.
   - No runtime errors in browser console when using Gmail features.

---

## Summary

This plan details:
- Exact secrets and env vars.
- Edge function behavior for Gmail sync and send (including CORS, admin token, Gmail OAuth, parsing, DB writes, and dedupe).
- Frontend API helpers and hooks.
- UI changes (minimal and layout-preserving).
- Comprehensive manual test checklist.

Following these steps will integrate Gmail into the Unified Inbox with manual sync and reply, while keeping the existing Twilio SMS/WhatsApp flows intact and maintaining overall app stability.

