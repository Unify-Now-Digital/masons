# Implementation Plan: Twilio Outbound Send Reply via Supabase Edge Function

## Feature Overview

Replace the DB-only Inbox “Send Reply” flow with Twilio outbound sending via a Supabase Edge Function. The frontend will call the Edge Function with an admin token, and the function will send SMS/WhatsApp via Twilio, insert the outbound message, and update conversation metadata. UI/UX remains unchanged.

**Branch:** `feature/inbox-send-reply-twilio-edge-function`  
**Spec File:** `specs/inbox-send-reply-twilio-edge-function.md`

---

## Technical Context

### Current State
- `useSendReply` directly inserts into `inbox_messages` and updates `inbox_conversations`
- No actual Twilio send; `status='sent'` is a placeholder
- Frontend uses React Query hooks for conversations/messages
- UI already disables send button while pending and clears textarea on success

### Target State
- Frontend calls Edge Function `inbox-twilio-send` with `X-Admin-Token`
- Edge Function sends SMS/WhatsApp via Twilio, inserts message, updates conversation
- Frontend only calls Edge Function; no direct DB insert/update for outbound

### Key Files
- Env: `.env.example`, `.env`
- Frontend API: `src/modules/inbox/api/inboxTwilio.api.ts` (new)
- Hooks: `src/modules/inbox/hooks/useInboxMessages.ts`
- UI: `src/modules/inbox/components/ConversationView.tsx`
- Edge Function: `supabase/functions/inbox-twilio-send/index.ts` (new)

### Constraints
- No schema changes
- Do not touch legacy `messages` table
- JWT should be OFF for this function (use admin token check)
- Keep UI layout/styling unchanged
- Defensive null handling and error logging (no secrets logged)

---

## Phases & Tasks (File-level)

### Phase 1 — Environment Variables
**Files:** `.env.example`, `.env` (manual), docs/README (optional note)
- Add to `.env.example`:
  - `VITE_SUPABASE_FUNCTIONS_URL=https://<PROJECT_REF>.supabase.co/functions/v1`
  - `VITE_INBOX_ADMIN_TOKEN=<admin-token>`
- Note: Restart dev server after env changes.

### Phase 2 — Edge Function: `inbox-twilio-send`
**File:** `supabase/functions/inbox-twilio-send/index.ts` (new)
- CORS + OPTIONS handling
- JWT: OFF; validate `X-Admin-Token` === `INBOX_ADMIN_TOKEN` secret
- Steps:
  1) Parse `conversation_id`, `body_text` (trim, reject empty)
  2) Load conversation by id (`channel`, `primary_handle`)
  3) Send via Twilio API (SMS/WhatsApp formatting for From/To)
  4) Insert outbound row into `inbox_messages`
  5) Update `inbox_conversations` (`last_message_at`, `last_message_preview`)
- Null/DB safe; log errors without secrets.
- Use service role key for DB operations.

### Phase 3 — Frontend API Helper
**File:** `src/modules/inbox/api/inboxTwilio.api.ts` (new)
- `sendTwilioMessage({ conversation_id, body_text })`
- POST to `${VITE_SUPABASE_FUNCTIONS_URL}/inbox-twilio-send`
- Headers: `Content-Type: application/json`, `X-Admin-Token: VITE_INBOX_ADMIN_TOKEN`
- Throw on non-200; return typed response.

### Phase 4 — Hook Update
**File:** `src/modules/inbox/hooks/useInboxMessages.ts`
- Replace DB-only mutation with `sendTwilioMessage` call.
- Keep validation (trim, reject empty).
- On success invalidate:
  - `inboxKeys.messages.byConversation(conversationId)`
  - `inboxKeys.conversations.all`
  - `inboxKeys.conversations.detail(conversationId)`
- Remove direct insert/update calls for outbound.

### Phase 5 — UI Polish (keep layout)
**File:** `src/modules/inbox/components/ConversationView.tsx`
- Ensure send button disabled while pending (already present; verify).
- Clear textarea on success (already present; verify).
- Surface error: add toast/alert or minimal inline message on mutation error (no layout change).

---

## Safety & Null Handling
- Validate `body_text` trim > 0 on frontend and Edge Function.
- Handle null `subject`/`preview`/`timestamps` gracefully.
- Do not log secrets; log status/error messages only.
- Twilio From/To formatting for WhatsApp: `whatsapp:+number`.

---

## Acceptance Checklist
- Outbound WhatsApp sends successfully (sandbox).
- Outbound SMS sends successfully (if reachable).
- Outbound messages appear in thread; preview/time updated.
- No direct DB insert/update for outbound in frontend (Edge Function only).
- Send button disabled while pending; textarea clears on success; error shown on failure.
- JWT off for this function; admin token validation enforced.
- Env vars added; dev server restart noted.

---

## Deliverables
- `.env.example` updated with new vars.
- `supabase/functions/inbox-twilio-send/index.ts` (Edge Function).
- `src/modules/inbox/api/inboxTwilio.api.ts` (API helper).
- `src/modules/inbox/hooks/useInboxMessages.ts` updated.
- `src/modules/inbox/components/ConversationView.tsx` error handling/disable-state verified.

