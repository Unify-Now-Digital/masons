# Add Gmail Email Integration to Unified Inbox (Manual Inbound Sync + Outbound Replies)

## Overview

**Goal:** Integrate a single shared Gmail mailbox into the Unified Inbox using Supabase Edge Functions, enabling manual inbound sync and outbound email replies while reusing the existing `inbox_conversations` and `inbox_messages` tables.

**Decisions (locked):**
- Inbound email sync is **manual** (button-triggered).
- **Single shared Gmail mailbox** (no per-user accounts).
- **Text-only** emails in v1 (no attachments).

**Context:**
- Unified Inbox already uses `inbox_conversations` / `inbox_messages` with channels: `email | sms | whatsapp`.
- Twilio-based SMS/WhatsApp outbound is already implemented via `inbox-twilio-send` Edge Function.
- We now need Gmail-based email ingest + replies using Gmail API via Supabase Edge Functions.
- No database schema changes are allowed; we must use existing columns (including a `meta` jsonb field on `inbox_messages` for Gmail IDs).

**Scope:**
- Edge functions:
  - `inbox-gmail-sync`: manual inbound sync from Gmail → `inbox_*` tables.
  - `inbox-gmail-send`: outbound replies for `channel='email'` conversations.
- Frontend:
  - API helpers: `syncGmail()` and `sendGmailReply()`.
  - Unified Inbox UI:
    - Manual “Sync Email” button (no layout/styling change, just an added control).
    - Send Reply routed by `conversation.channel`:
      - `email` → `inbox-gmail-send`
      - `sms`/`whatsapp` → existing `inbox-twilio-send`
- No attachments, no schema changes, build must pass.

---

## Current State Analysis

### Inbox Data Model

**Table:** `public.inbox_conversations`
- `id uuid primary key`
- `channel text` (`'email' | 'sms' | 'whatsapp'`)
- `primary_handle text` (email address or phone number)
- `subject text null`
- `status text` (`'open' | 'archived' | 'closed'`)
- `unread_count int`
- `last_message_at timestamptz null`
- `last_message_preview text null`
- `created_at timestamptz`
- `updated_at timestamptz`

**Table:** `public.inbox_messages`
- `id uuid primary key`
- `conversation_id uuid` (FK → `inbox_conversations.id`)
- `channel text` (`'email' | 'sms' | 'whatsapp'`)
- `direction text` (`'inbound' | 'outbound'`)
- `from_handle text`
- `to_handle text`
- `body_text text`
- `subject text null`
- `sent_at timestamptz`
- `status text` (`'sent' | 'delivered' | 'failed'`)
- `meta jsonb` (assumed existing; used for provider-specific metadata)
- `created_at timestamptz`
- `updated_at timestamptz`

**Meta usage for Gmail (v1):**
- `meta.gmail.messageId: string`
- `meta.gmail.threadId: string`

### Existing Edge Functions

- `supabase/functions/inbox-twilio-send/index.ts`
  - Protected by `X-Admin-Token == INBOX_ADMIN_TOKEN`.
  - Uses `SUPABASE_SERVICE_ROLE_KEY` for DB access.
  - Sends SMS/WhatsApp via Twilio and inserts outbound `inbox_messages` rows.
  - Updates `inbox_conversations.last_message_at` / `.last_message_preview`.

- `supabase/functions/gmail-sync/index.ts`, `gmail-oauth/index.ts` (legacy Gmail data model)
  - Use `gmail_accounts` / `gmail_emails` tables.
  - Not yet wired to `inbox_*` data model.

### Current Inbox Frontend

- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - Uses `inbox_conversations` for conversation list (filters by tab + search).
  - Uses `ConversationView` on the right-hand side.

- `src/modules/inbox/components/ConversationView.tsx`
  - Uses `useConversation` + `useMessagesByConversation` for DB data.
  - Uses `useSendReply`:
    - For all channels, currently routes to `inbox-twilio-send`-style logic (DB+Twilio).
    - UI: reply textarea + “Send Reply” button, disabled while pending, clears on success, shows inline error text on failure.

**Observations:**
- No Gmail → `inbox_*` mapping yet.
- No Gmail-based send function; all outbound currently uses Twilio pipeline.
- Channel-aware send routing is not yet implemented.

---

## Recommended Data & Relationship Usage

- **Conversations (`inbox_conversations`)**
  - `channel = 'email'`
  - `primary_handle = fromEmail` (or toEmail, depending on direction; for shared mailbox we treat primary handle as the customer email address).
  - `subject = email subject`

- **Messages (`inbox_messages`)**
  - `channel = 'email'`
  - `direction`:
    - `'inbound'` when email is from customer → shared mailbox.
    - `'outbound'` when from shared mailbox → customer.
  - `from_handle` / `to_handle`:
    - Use email addresses (e.g. `customer@example.com`, `shared@workshop.co.uk`).
  - `body_text`:
    - Plain text version of the email body (strip HTML).
  - `subject`:
    - Per-message subject (for email threads, usually same as conversation subject).
  - `meta.gmail.messageId` / `meta.gmail.threadId`:
    - Required for threading and replies.

**Conversation Upsert Rule (Gmail threads):**
- Conversation identity = `gmail.threadId` (one conversation per Gmail thread).
- For inbound or outbound email with `threadId = T`:
  - If conversation with `meta.gmail.threadId = T` exists → reuse.
  - Else create new conversation with:
    - `channel = 'email'`
    - `primary_handle = customer email`
    - `subject = email subject`
    - `status = 'open'`
    - `unread_count = 1` for first inbound, 0 for outbound-only (rare).

---

## Implementation Approach

### Phase 1: Environment & Secrets (No Schema Changes)

**Goal:** Ensure required secrets and env vars exist.

**Backend Secrets (Supabase):**
- `INBOX_ADMIN_TOKEN` (already used by Twilio).
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SHARED_EMAIL` (the shared mailbox address, e.g. `inbox@workshop.co.uk`).

**Frontend env vars (already partially present):**
- `VITE_SUPABASE_FUNCTIONS_URL`  
- `VITE_INBOX_ADMIN_TOKEN`

**Notes:**
- No new frontend env vars required specifically for Gmail; reuse admin token + functions URL.
- Document Gmail secrets in internal ops docs.

---

### Phase 2: Edge Function — `inbox-gmail-sync`

**File:** `supabase/functions/inbox-gmail-sync/index.ts` (new)

**Purpose:** Manually sync recent emails from shared Gmail mailbox into `inbox_*` tables.

**Security:**
- Protected by `X-Admin-Token == INBOX_ADMIN_TOKEN`.
- JWT-based auth: **OFF** (we rely on admin token, like `inbox-twilio-send`).
- CORS enabled (`POST, OPTIONS`).

**Request:**
- `POST /inbox-gmail-sync`
- Body (optional):
  - `since?: string` (ISO date, for incremental sync)
  - `maxMessages?: number` (limit; default e.g. 50)

**High-Level Logic:**
1. **CORS & Token:**
   - Accept `OPTIONS` for CORS preflight.
   - Check `X-Admin-Token` header against `INBOX_ADMIN_TOKEN`.
2. **Initialize Gmail Client:**
   - Use Node/Fetch + Google OAuth (client id, secret, refresh token) to obtain access token.
   - Target mailbox: `GMAIL_SHARED_EMAIL`.
3. **Fetch Messages:**
   - Use Gmail REST API (`users.messages.list`, `users.messages.get`).
   - Filter:
     - Label `INBOX`.
     - Not in Trash/Spam.
     - `q` parameter for `after` date if `since` is provided.
   - For each message:
     - Retrieve headers (Subject, From, To, Date, Message-ID, Thread-ID).
     - Retrieve plain text body (`payload.parts` or fallback from HTML).
4. **Normalize Into Conversations/Messages:**
   - Extract:
     - `messageId`
     - `threadId`
     - `fromEmail`, `toEmail`
     - `subject`
     - `bodyText`
     - `sentAt` (parsed from Date header; fall back on Gmail internalDate).
   - Determine direction:
     - If `fromEmail === GMAIL_SHARED_EMAIL` → `direction='outbound'`.
     - Else → `direction='inbound'`.
   - Determine `primary_handle`:
     - For inbound: primary handle = `fromEmail`.
     - For outbound: primary handle = `toEmail` (customer).
5. **Upsert Conversation:**
   - Use `threadId` to find existing conversation:
     - Query `inbox_conversations` joined to `inbox_messages` or by storing `meta.gmail.threadId` on initial creation (preferred).
     - Since no schema change allowed, store threadId in the first message’s `meta.gmail.threadId` and, if needed, also in conversation `primary_handle` + `subject` combination; or piggyback on a naming convention in `meta` for conversation if supported.
   - If conversation not found:
     - Insert new `inbox_conversations` row:
       - `channel = 'email'`
       - `primary_handle = primary_handle`
       - `subject = subject`
       - `status = 'open'`
       - `unread_count = direction === 'inbound' ? 1 : 0`
       - `last_message_at = sentAt`
       - `last_message_preview = bodyText.slice(0, 120)`
6. **Insert Message:**
   - Insert into `inbox_messages`:
     - `conversation_id`
     - `channel = 'email'`
     - `direction`
     - `from_handle = fromEmail`
     - `to_handle = toEmail`
     - `body_text = bodyText`
     - `subject`
     - `sent_at = sentAt`
     - `status = direction === 'outbound' ? 'sent' : 'sent'` (inbound uses `'sent'` as generic delivered state)
     - `meta = jsonb_build_object('gmail', jsonb_build_object('messageId', messageId, 'threadId', threadId))`
   - **Idempotency:** To avoid duplicates, perform `insert ... on conflict (unique_message_constraint) do nothing` if such a constraint exists on `meta.gmail.messageId`. If not, approximate by checking existence before insert.
7. **Update Conversation Metadata:**
   - For each message processed:
     - `last_message_at = GREATEST(existing_last_message_at, sentAt)`
     - `last_message_preview = bodyText.slice(0, 120)` for the latest message
     - If `direction='inbound'`:
       - `unread_count = unread_count + 1` (unless conversation is closed/archived; simple v1 rule: always increment while status='open').

**Logging & Error Handling:**
- Log high-level errors (e.g. “Gmail API error with status X”) **without** logging tokens or sensitive data.
- Return aggregated summary:
  - `syncedCount`
  - `skippedCount`
  - `errorsCount`

---

### Phase 3: Edge Function — `inbox-gmail-send`

**File:** `supabase/functions/inbox-gmail-send/index.ts` (new)

**Purpose:** Send outbound reply for a given conversation via Gmail API, using the Gmail thread, and record it in `inbox_messages`.

**Security:**
- Protected by `X-Admin-Token == INBOX_ADMIN_TOKEN`.
- CORS enabled (`POST, OPTIONS`).

**Request:**
- `POST /inbox-gmail-send`
- Body:
  - `conversation_id: string`
  - `body_text: string`

**High-Level Logic:**
1. **CORS & Token Validation:** same pattern as `inbox-gmail-sync`.
2. **Load Conversation & Last Gmail Metadata:**
   - Fetch `inbox_conversations` row (`id, channel, primary_handle, subject`).
   - Ensure `channel === 'email'`.
   - Fetch latest `inbox_messages` row for this `conversation_id` with `channel='email'` where `meta.gmail.threadId` is not null.
   - Extract:
     - `gmail.threadId`
     - `gmail.messageId` (optional, for `In-Reply-To` / `References` headers).
3. **Prepare Gmail API Call:**
   - Use `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` to obtain `access_token`.
   - Construct RFC 2822 message:
     - `From: GMAIL_SHARED_EMAIL`
     - `To: conversation.primary_handle`
     - `Subject: Re: <conversation.subject>` (if subject starts with `Re:`, avoid doubling).
     - `In-Reply-To` and `References` headers set to `gmail.messageId` when available.
     - Body: `body_text` in plain text.
   - Base64URL encode message and POST to:
     - `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
     - With `threadId` to keep messages in same thread.
4. **On Success:**
   - Gmail returns `id` (messageId) and `threadId`.
   - Insert outbound `inbox_messages` row:
     - `conversation_id`
     - `channel='email'`
     - `direction='outbound'`
     - `from_handle = GMAIL_SHARED_EMAIL`
     - `to_handle = conversation.primary_handle`
     - `body_text = body_text.trim()`
     - `subject = conversation.subject` (or `Re: subject`)
     - `sent_at = now()`
     - `status='sent'`
     - `meta.gmail.messageId = gmailResponse.id`
     - `meta.gmail.threadId = gmailResponse.threadId`
   - Update `inbox_conversations`:
     - `last_message_at = now()`
     - `last_message_preview = body_text.trim().slice(0, 120)`
     - Do **not** change `unread_count`.
5. **On Failure:**
   - Log status and error text but not tokens.
   - Return `500` with generic error.

---

### Phase 4: Frontend API Helpers

**File:** `src/modules/inbox/api/inboxGmail.api.ts` (new)

**Functions:**
1. `syncGmail()`
   - `POST` → `${VITE_SUPABASE_FUNCTIONS_URL}/inbox-gmail-sync`
   - Headers:
     - `Content-Type: application/json`
     - `X-Admin-Token: VITE_INBOX_ADMIN_TOKEN`
   - Optional body: `{ since?: string, maxMessages?: number }`.
   - Returns summary `{ syncedCount, skippedCount, errorsCount }`.

2. `sendGmailReply({ conversationId, bodyText })`
   - `POST` → `${VITE_SUPABASE_FUNCTIONS_URL}/inbox-gmail-send`
   - Headers: same as above.
   - Body: `{ conversation_id: conversationId, body_text: bodyText }`.
   - Throws on non-OK; returns typed success response.

**Null/Defensive Handling:**
- Both helpers:
  - Validate `VITE_SUPABASE_FUNCTIONS_URL` and `VITE_INBOX_ADMIN_TOKEN` exist, else throw configuration error.
  - Gracefully parse JSON; if parse fails, throw generic error.

---

### Phase 5: Hook Updates (Send Reply Routing)

**File:** `src/modules/inbox/hooks/useInboxMessages.ts`

**Goal:** Route send reply based on `conversation.channel`:
- `email` → `sendGmailReply` (Gmail function).
- `sms`/`whatsapp` → existing `sendTwilioMessage`.

**Implementation Sketch:**
- Extend `useSendReply` to accept `channel` or fetch conversation inside hook:
  - Option A (simpler): pass `channel` and `primary_handle` from `ConversationView` into `useSendReply` mutation.
  - Option B: inside `useSendReply`, fetch conversation by id before deciding route (extra DB call).
- Logic:
  ```ts
  if (channel === 'email') {
    await sendGmailReply({ conversationId, bodyText: trimmedBodyText });
  } else {
    await sendTwilioMessage({ conversation_id: conversationId, body_text: trimmedBodyText });
  }
  ```
- Cache invalidation unchanged:
  - `inboxKeys.messages.byConversation(conversationId)`
  - `inboxKeys.conversations.all`
  - `inboxKeys.conversations.detail(conversationId)`

**Requirement:** No direct DB insert/update for outbound emails from the frontend; all via Edge Functions.

---

### Phase 6: Inbox UI — Sync Button & Behavior

**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Goal:** Add manual “Sync Email” button; keep layout/styling effectively unchanged.

**Implementation:**
- Add a small button to the top-right controls, e.g. near Archive / Mark as Read:
  - “Sync Email” or “Sync Gmail”.
- Wire it to a new `useSyncGmail` mutation hook that calls `syncGmail()`:
  - Show a subtle loading state (e.g. button disabled + “Syncing...” label).
  - On success, invalidate conversation list queries.
  - On error, show toast/alert.
- Do **not** rearrange existing layout; add the button inline with existing controls using same shadcn styles.

---

### Phase 7: UI — Send Reply Integration (Email vs SMS/WhatsApp)

**File:** `src/modules/inbox/components/ConversationView.tsx`

**Goal:** Use `conversation.channel` to choose the correct send route.

**Implementation:**
- When calling `sendReplyMutation.mutate({ conversationId, bodyText })`, also pass `channel`:
  - Either extend the mutation input type, or wrap `useSendReply` so it knows `channel`.
- UI behavior stays the same:
  - Disable send while pending.
  - Clear textarea on success.
  - Show inline error text on failure.
- Ensure error messages from both Gmail and Twilio flows are surfaced consistently.

---

## Safety Considerations

### Security
- All new functions (`inbox-gmail-sync`, `inbox-gmail-send`) protected by `X-Admin-Token == INBOX_ADMIN_TOKEN`.
- Gmail client ID/secret/refresh token stored only in Supabase secrets.
- No OAuth tokens or Twilio/Gmail credentials sent to the frontend.
- Logs must not include tokens or raw headers; only high-level error messages and status codes.

### Data Integrity
- `unread_count` only incremented on inbound messages during sync; never on outbound.
- `last_message_at` and `last_message_preview` reflect most recent message.
- Gmail `messageId` / `threadId` stored in `meta` ensures proper threading and idempotency.

### Null Handling
- Defensive parsing of Gmail headers/bodies:
  - If subject missing → fallback to `'(no subject)'`.
  - If bodyText cannot be extracted → fallback to empty string or “[no content]”.
  - If Date header invalid → fallback to Gmail internalDate → fallback to `now()`.
- Frontend helpers throw user-friendly errors when config/env is missing.

---

## What NOT to Do

- ❌ Do **not** change table schemas (no migrations).
- ❌ Do **not** touch or reuse legacy `gmail_emails` / `gmail_accounts` for UI; use `inbox_*` instead.
- ❌ Do **not** expose Gmail or Twilio secrets to the frontend.
- ❌ Do **not** change Unified Inbox layout or visual hierarchy (only additive controls).
- ❌ Do **not** implement attachments, HTML rendering, or advanced Gmail labels in v1.
- ❌ Do **not** auto-sync emails (no background cron; manual sync only).

---

## Open Questions / Considerations

1. **`meta` Column Guarantee:** Confirm `inbox_messages.meta` jsonb column exists; if not, we must either:
   - Add it via migration (would conflict with “no schema changes”), or
   - Use another existing jsonb/text field for Gmail IDs.
2. **Idempotency Strategy:** Best approach is a unique index on `(channel, meta->'gmail'->>'messageId')` to avoid duplicates; if unavailable, use application-level checks.
3. **Sync Window:** How many days/messages to sync per manual run? v1 can use last 1–7 days or a fixed max count (e.g. 50).
4. **Unread Semantics:** Syncing old emails might re-count unread messages; we may want to only increment unread for *new* emails beyond last known message time.
5. **Error Reporting in UI:** Whether to surface Gmail/Twilio-specific error messages or generic “Unable to send email” to end-users.

---

## Acceptance Criteria

✅ Manual “Sync Email” button:
- Triggers `inbox-gmail-sync` Edge Function.
- New/updated emails appear as `channel='email'` conversations/messages.
- `unread_count` increases correctly for new inbound messages.

✅ Outbound email replies:
- For `channel='email'`, Send Reply calls `inbox-gmail-send`.
- Email is delivered via Gmail (threaded correctly in same Gmail thread).
- Outbound `inbox_messages` rows inserted with correct `meta.gmail` IDs.
- Conversation preview/time updated.

✅ Channel-aware routing:
- `channel='email'` → Gmail Edge Function.
- `channel='sms' | 'whatsapp'` → Twilio Edge Function.
- Frontend never directly inserts/updates outbound email messages.

✅ Stability:
- Build passes (`tsc`, Vite build).
- No runtime crashes when env vars or secrets are missing (clear error messages).
- Null/edge cases handled gracefully.

---

**Specification Version:** 1.0  
**Created:** 2025-01-11  
**Status:** Ready for Implementation

