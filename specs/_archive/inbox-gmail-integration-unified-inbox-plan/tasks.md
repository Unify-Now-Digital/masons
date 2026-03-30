# Tasks: Gmail Integration (Manual Sync + Reply) for Unified Inbox

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| A.1 | Verify/Update .env.example with inbox vars | Update | `.env.example` | High | None | A |
| A.2 | Verify .env has required vars | Verify | `.env` | High | None | A |
| B.1 | Create inbox-gmail-sync function shell | Create | `supabase/functions/inbox-gmail-sync/index.ts` | High | None | B |
| B.2 | Implement CORS handling | Create | `supabase/functions/inbox-gmail-sync/index.ts` | High | B.1 | B |
| B.3 | Implement admin token check | Create | `supabase/functions/inbox-gmail-sync/index.ts` | High | B.2 | B |
| B.4 | Implement Gmail OAuth refresh token flow | Create | `supabase/functions/inbox-gmail-sync/index.ts` | High | B.3 | B |
| B.5 | Implement Gmail messages.list fetch | Create | `supabase/functions/inbox-gmail-sync/index.ts` | High | B.4 | B |
| B.6 | Implement Gmail message parsing | Create | `supabase/functions/inbox-gmail-sync/index.ts` | High | B.5 | B |
| B.7 | Implement conversation upsert logic | Create | `supabase/functions/inbox-gmail-sync/index.ts` | High | B.6 | B |
| B.8 | Implement message insert with dedupe | Create | `supabase/functions/inbox-gmail-sync/index.ts` | High | B.7 | B |
| B.9 | Implement conversation metadata updates | Create | `supabase/functions/inbox-gmail-sync/index.ts` | High | B.8 | B |
| C.1 | Create inbox-gmail-send function shell | Create | `supabase/functions/inbox-gmail-send/index.ts` | High | None | C |
| C.2 | Implement CORS and admin token | Create | `supabase/functions/inbox-gmail-send/index.ts` | High | C.1 | C |
| C.3 | Implement conversation and metadata loading | Create | `supabase/functions/inbox-gmail-send/index.ts` | High | C.2 | C |
| C.4 | Implement Gmail auth and RFC 2822 email | Create | `supabase/functions/inbox-gmail-send/index.ts` | High | C.3 | C |
| C.5 | Implement Gmail send API call | Create | `supabase/functions/inbox-gmail-send/index.ts` | High | C.4 | C |
| C.6 | Implement DB writes and response | Create | `supabase/functions/inbox-gmail-send/index.ts` | High | C.5 | C |
| D.1 | Create inboxGmail.api.ts | Create | `src/modules/inbox/api/inboxGmail.api.ts` | High | None | D |
| D.2 | Implement syncGmail function | Create | `src/modules/inbox/api/inboxGmail.api.ts` | High | D.1 | D |
| D.3 | Implement sendGmailReply function | Create | `src/modules/inbox/api/inboxGmail.api.ts` | High | D.1 | D |
| D.4 | Update useSendReply to route by channel | Update | `src/modules/inbox/hooks/useInboxMessages.ts` | High | D.3 | D |
| D.5 | Create useSyncGmail hook | Create | `src/modules/inbox/hooks/useInboxConversations.ts` | High | D.2 | D |
| D.6 | Add Sync Email button to UnifiedInboxPage | Update | `src/modules/inbox/pages/UnifiedInboxPage.tsx` | High | D.5 | D |
| D.7 | Update ConversationView to pass channel | Update | `src/modules/inbox/components/ConversationView.tsx` | High | D.4 | D |
| E.1 | Build validation | Verify | - | High | All | E |
| E.2 | TypeScript validation | Verify | - | High | All | E |

---

## Phase A: Secrets & Configuration

### Task A.1: Verify/Update .env.example with inbox vars

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** None  
**File:** `.env.example`

**Description:**
Ensure `.env.example` includes `VITE_SUPABASE_FUNCTIONS_URL` and `VITE_INBOX_ADMIN_TOKEN` with comments.

**Acceptance Criteria:**
- [ ] `VITE_SUPABASE_FUNCTIONS_URL` present with example value
- [ ] `VITE_INBOX_ADMIN_TOKEN` present with placeholder
- [ ] Both have helpful comments

---

### Task A.2: Verify .env has required vars

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** None  
**File:** `.env`

**Description:**
Verify `.env` has actual values for `VITE_SUPABASE_FUNCTIONS_URL` and `VITE_INBOX_ADMIN_TOKEN`.

**Acceptance Criteria:**
- [ ] Both vars are set (not empty)
- [ ] Values match expected format

---

## Phase B: Edge Function - inbox-gmail-sync

### Task B.1: Create inbox-gmail-sync function shell

**Type:** CREATE  
**Priority:** High  
**Dependencies:** None  
**File:** `supabase/functions/inbox-gmail-sync/index.ts`

**Description:**
Create new edge function file with Deno.serve entry point.

**Acceptance Criteria:**
- [ ] File created in correct location
- [ ] Uses Deno.serve
- [ ] Basic request handling structure

---

### Task B.2: Implement CORS handling

**Type:** CREATE  
**Priority:** High  
**Dependencies:** B.1  
**File:** `supabase/functions/inbox-gmail-sync/index.ts`

**Description:**
Add CORS headers and handle OPTIONS requests.

**Acceptance Criteria:**
- [ ] CORS headers defined (POST, OPTIONS)
- [ ] OPTIONS requests return 200 with CORS headers
- [ ] Non-POST/OPTIONS return 405

---

### Task B.3: Implement admin token check

**Type:** CREATE  
**Priority:** High  
**Dependencies:** B.2  
**File:** `supabase/functions/inbox-gmail-sync/index.ts`

**Description:**
Validate X-Admin-Token header against INBOX_ADMIN_TOKEN secret.

**Acceptance Criteria:**
- [ ] Reads X-Admin-Token header (case-insensitive)
- [ ] Compares against INBOX_ADMIN_TOKEN
- [ ] Returns 401 if missing/mismatch
- [ ] Includes CORS headers in error response

---

### Task B.4: Implement Gmail OAuth refresh token flow

**Type:** CREATE  
**Priority:** High  
**Dependencies:** B.3  
**File:** `supabase/functions/inbox-gmail-sync/index.ts`

**Description:**
Load Gmail secrets and exchange refresh token for access token.

**Acceptance Criteria:**
- [ ] Loads GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL
- [ ] Validates all secrets present
- [ ] POSTs to oauth2.googleapis.com/token
- [ ] Parses access_token from response
- [ ] Handles errors safely (no token logging)

---

### Task B.5: Implement Gmail messages.list fetch

**Type:** CREATE  
**Priority:** High  
**Dependencies:** B.4  
**File:** `supabase/functions/inbox-gmail-sync/index.ts`

**Description:**
Fetch list of messages from Gmail INBOX using messages.list API.

**Acceptance Criteria:**
- [ ] Parses optional request body (since, maxMessages)
- [ ] Calls users.messages.list with labelIds=INBOX
- [ ] Respects maxMessages (default 50, max 100)
- [ ] Handles optional since parameter
- [ ] Returns array of message IDs

---

### Task B.6: Implement Gmail message parsing

**Type:** CREATE  
**Priority:** High  
**Dependencies:** B.5  
**File:** `supabase/functions/inbox-gmail-sync/index.ts`

**Description:**
For each message ID, fetch full message and parse headers/body.

**Acceptance Criteria:**
- [ ] Calls users.messages.get for each message ID
- [ ] Extracts threadId, messageId, headers (Date, From, To, Subject)
- [ ] Parses email addresses from From/To headers
- [ ] Determines sentAt (Date header → internalDate → now)
- [ ] Extracts bodyText (prefer text/plain, fallback to HTML stripped, then snippet)
- [ ] Determines direction (fromEmail === GMAIL_USER_EMAIL → outbound)
- [ ] Determines primary_handle (inbound: fromEmail, outbound: toEmail)
- [ ] Handles missing subject (defaults to '(no subject)')

---

### Task B.7: Implement conversation upsert logic

**Type:** CREATE  
**Priority:** High  
**Dependencies:** B.6  
**File:** `supabase/functions/inbox-gmail-sync/index.ts`

**Description:**
Find or create conversation based on Gmail threadId.

**Acceptance Criteria:**
- [ ] Queries inbox_messages for existing message with meta.gmail.threadId
- [ ] If found, uses existing conversation_id
- [ ] If not found, inserts new inbox_conversations row:
  - channel='email'
  - primary_handle, subject, status='open'
  - unread_count based on direction
  - last_message_at, last_message_preview
- [ ] Returns conversation_id for message insert

---

### Task B.8: Implement message insert with dedupe

**Type:** CREATE  
**Priority:** High  
**Dependencies:** B.7  
**File:** `supabase/functions/inbox-gmail-sync/index.ts`

**Description:**
Insert message with deduplication check by Gmail messageId.

**Acceptance Criteria:**
- [ ] Checks for existing message with meta.gmail.messageId before insert
- [ ] Skips insert if message already exists
- [ ] Inserts new inbox_messages row with:
  - conversation_id, channel='email', direction
  - from_handle, to_handle, body_text, subject
  - sent_at, status='sent'
  - meta.gmail.messageId and threadId
- [ ] Tracks syncedCount, skippedCount, errorsCount

---

### Task B.9: Implement conversation metadata updates

**Type:** CREATE  
**Priority:** High  
**Dependencies:** B.8  
**File:** `supabase/functions/inbox-gmail-sync/index.ts`

**Description:**
Update conversation last_message_at, preview, and unread_count.

**Acceptance Criteria:**
- [ ] Updates last_message_at to GREATEST(existing, sentAt)
- [ ] Updates last_message_preview for latest message
- [ ] Increments unread_count for inbound messages when status='open'
- [ ] Returns summary: { syncedCount, skippedCount, errorsCount }

---

## Phase C: Edge Function - inbox-gmail-send

### Task C.1: Create inbox-gmail-send function shell

**Type:** CREATE  
**Priority:** High  
**Dependencies:** None  
**File:** `supabase/functions/inbox-gmail-send/index.ts`

**Description:**
Create new edge function file with Deno.serve entry point.

**Acceptance Criteria:**
- [ ] File created in correct location
- [ ] Uses Deno.serve
- [ ] Basic request handling structure

---

### Task C.2: Implement CORS and admin token

**Type:** CREATE  
**Priority:** High  
**Dependencies:** C.1  
**File:** `supabase/functions/inbox-gmail-send/index.ts`

**Description:**
Add CORS headers, handle OPTIONS, validate admin token.

**Acceptance Criteria:**
- [ ] CORS headers defined
- [ ] OPTIONS handled
- [ ] Admin token validated
- [ ] Returns 401 if unauthorized

---

### Task C.3: Implement conversation and metadata loading

**Type:** CREATE  
**Priority:** High  
**Dependencies:** C.2  
**File:** `supabase/functions/inbox-gmail-send/index.ts`

**Description:**
Parse request body, fetch conversation, and get Gmail threadId.

**Acceptance Criteria:**
- [ ] Parses { conversation_id, body_text }
- [ ] Validates non-empty conversation_id and body_text
- [ ] Fetches conversation from inbox_conversations
- [ ] Validates channel='email' (returns 400 if not)
- [ ] Fetches latest message with Gmail metadata
- [ ] Extracts threadId and messageId from meta
- [ ] Returns 400 if no Gmail thread found

---

### Task C.4: Implement Gmail auth and RFC 2822 email

**Type:** CREATE  
**Priority:** High  
**Dependencies:** C.3  
**File:** `supabase/functions/inbox-gmail-send/index.ts`

**Description:**
Obtain access token and build RFC 2822 email message.

**Acceptance Criteria:**
- [ ] Obtains access token via refresh token flow
- [ ] Builds email with:
  - From: GMAIL_USER_EMAIL
  - To: conversation.primary_handle
  - Subject: Re: <subject> (handles existing Re: prefix)
  - In-Reply-To and References headers (if messageId available)
  - Body: plain text body_text.trim()
- [ ] Base64URL encodes full RFC 2822 message

---

### Task C.5: Implement Gmail send API call

**Type:** CREATE  
**Priority:** High  
**Dependencies:** C.4  
**File:** `supabase/functions/inbox-gmail-send/index.ts`

**Description:**
POST to Gmail send API with raw message and threadId.

**Acceptance Criteria:**
- [ ] POSTs to gmail.googleapis.com/gmail/v1/users/me/messages/send
- [ ] Body includes raw (base64url) and threadId
- [ ] Handles errors safely (no token logging)
- [ ] Returns Gmail response with id and threadId

---

### Task C.6: Implement DB writes and response

**Type:** CREATE  
**Priority:** High  
**Dependencies:** C.5  
**File:** `supabase/functions/inbox-gmail-send/index.ts`

**Description:**
Insert outbound message and update conversation metadata.

**Acceptance Criteria:**
- [ ] Inserts inbox_messages row:
  - conversation_id, channel='email', direction='outbound'
  - from_handle=GMAIL_USER_EMAIL, to_handle=conversation.primary_handle
  - body_text, subject, sent_at=now(), status='sent'
  - meta.gmail.messageId and threadId from Gmail response
- [ ] Updates conversation:
  - last_message_at=now()
  - last_message_preview=body_text.slice(0, 120)
  - Does not change unread_count
- [ ] Returns { success: true, gmailMessageId, gmailThreadId }
- [ ] On failure, returns 500 with generic error

---

## Phase D: Frontend Changes

### Task D.1: Create inboxGmail.api.ts

**Type:** CREATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/inbox/api/inboxGmail.api.ts`

**Description:**
Create new API helper file for Gmail functions.

**Acceptance Criteria:**
- [ ] File created in correct location
- [ ] Exports syncGmail and sendGmailReply functions
- [ ] Validates env vars exist

---

### Task D.2: Implement syncGmail function

**Type:** CREATE  
**Priority:** High  
**Dependencies:** D.1  
**File:** `src/modules/inbox/api/inboxGmail.api.ts`

**Description:**
Implement syncGmail API call to inbox-gmail-sync edge function.

**Acceptance Criteria:**
- [ ] POSTs to ${VITE_SUPABASE_FUNCTIONS_URL}/inbox-gmail-sync
- [ ] Headers: Content-Type, X-Admin-Token
- [ ] Body: optional { since, maxMessages }
- [ ] Returns { syncedCount, skippedCount, errorsCount }
- [ ] Throws on non-200 or error response
- [ ] Validates env vars before calling

---

### Task D.3: Implement sendGmailReply function

**Type:** CREATE  
**Priority:** High  
**Dependencies:** D.1  
**File:** `src/modules/inbox/api/inboxGmail.api.ts`

**Description:**
Implement sendGmailReply API call to inbox-gmail-send edge function.

**Acceptance Criteria:**
- [ ] POSTs to ${VITE_SUPABASE_FUNCTIONS_URL}/inbox-gmail-send
- [ ] Headers: Content-Type, X-Admin-Token
- [ ] Body: { conversation_id, body_text }
- [ ] Returns typed success response
- [ ] Throws on error
- [ ] Validates env vars before calling

---

### Task D.4: Update useSendReply to route by channel

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** D.3  
**File:** `src/modules/inbox/hooks/useInboxMessages.ts`

**Description:**
Modify useSendReply to accept channel and route to Gmail or Twilio.

**Acceptance Criteria:**
- [ ] Mutation input includes channel parameter
- [ ] Routes to sendGmailReply if channel='email'
- [ ] Routes to sendTwilioMessage if channel='sms' or 'whatsapp'
- [ ] Cache invalidation unchanged (messages, conversations)

---

### Task D.5: Create useSyncGmail hook

**Type:** CREATE  
**Priority:** High  
**Dependencies:** D.2  
**File:** `src/modules/inbox/hooks/useInboxConversations.ts`

**Description:**
Create mutation hook for syncing Gmail.

**Acceptance Criteria:**
- [ ] Uses useMutation with syncGmail
- [ ] On success, invalidates inboxKeys.conversations.all
- [ ] Returns mutation object with isPending, mutate, etc.

---

### Task D.6: Add Sync Email button to UnifiedInboxPage

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** D.5  
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Description:**
Add "Sync Email" button to Unified Inbox page.

**Acceptance Criteria:**
- [ ] Button added near Archive/Mark as Read controls
- [ ] Uses shadcn Button component (outline, sm)
- [ ] Disabled while syncGmailMutation.isPending
- [ ] Shows "Syncing…" text when pending
- [ ] Calls syncGmailMutation.mutate() on click
- [ ] Does not change existing layout/structure
- [ ] Shows toast/alert on error

---

### Task D.7: Update ConversationView to pass channel

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** D.4  
**File:** `src/modules/inbox/components/ConversationView.tsx`

**Description:**
Pass channel to sendReplyMutation when calling mutate.

**Acceptance Criteria:**
- [ ] sendReplyMutation.mutate includes channel parameter
- [ ] Channel comes from conversation.channel
- [ ] Existing behavior unchanged (disable while pending, clear on success, show error)

---

## Phase E: Testing & Validation

### Task E.1: Build validation

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify build passes.

**Acceptance Criteria:**
- [ ] `npm run build` succeeds
- [ ] No build errors or warnings

---

### Task E.2: TypeScript validation

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify TypeScript compilation passes.

**Acceptance Criteria:**
- [ ] `npx tsc --noEmit` succeeds
- [ ] No TypeScript errors

---

## Progress Tracking

### Phase A: Secrets & Configuration
- [X] Task A.1: Verify/Update .env.example with inbox vars
- [X] Task A.2: Verify .env has required vars

### Phase B: Edge Function - inbox-gmail-sync
- [X] Task B.1: Create inbox-gmail-sync function shell
- [X] Task B.2: Implement CORS handling
- [X] Task B.3: Implement admin token check
- [X] Task B.4: Implement Gmail OAuth refresh token flow
- [X] Task B.5: Implement Gmail messages.list fetch
- [X] Task B.6: Implement Gmail message parsing
- [X] Task B.7: Implement conversation upsert logic
- [X] Task B.8: Implement message insert with dedupe
- [X] Task B.9: Implement conversation metadata updates

### Phase C: Edge Function - inbox-gmail-send
- [X] Task C.1: Create inbox-gmail-send function shell
- [X] Task C.2: Implement CORS and admin token
- [X] Task C.3: Implement conversation and metadata loading
- [X] Task C.4: Implement Gmail auth and RFC 2822 email
- [X] Task C.5: Implement Gmail send API call
- [X] Task C.6: Implement DB writes and response

### Phase D: Frontend Changes
- [X] Task D.1: Create inboxGmail.api.ts
- [X] Task D.2: Implement syncGmail function
- [X] Task D.3: Implement sendGmailReply function
- [X] Task D.4: Update useSendReply to route by channel
- [X] Task D.5: Create useSyncGmail hook
- [X] Task D.6: Add Sync Email button to UnifiedInboxPage
- [X] Task D.7: Update ConversationView to pass channel

### Phase E: Testing & Validation
- [X] Task E.1: Build validation
- [X] Task E.2: TypeScript validation

---

## Notes

- No database schema changes allowed
- Reuse existing inbox_conversations and inbox_messages tables
- Manual sync only (no auto-sync/cron)
- Text-only emails (no attachments in v1)
- Single shared Gmail mailbox
- Channel-aware routing: email → Gmail, sms/whatsapp → Twilio
