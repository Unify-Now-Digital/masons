# Implement Twilio SMS Integration for Unified Inbox (Inbound + Outbound)

## Overview

**Goal:** Integrate Twilio SMS into the Unified Inbox using Supabase Edge Functions: inbound SMS via a public webhook create/update conversations and insert inbound messages; outbound SMS sent from the Inbox UI go through an admin-protected Edge Function. Reuse existing `inbox_conversations` and `inbox_messages` tables. Follow the same patterns as Gmail and existing Twilio WhatsApp integrations (Edge Functions, service role, `INBOX_ADMIN_TOKEN`).

**Decisions (locked):**
- **Inbound:** Twilio webhook → public Edge Function `twilio-sms-webhook`. Idempotent using `MessageSid`; store Twilio metadata in `inbox_messages.meta`.
- **Outbound:** "Send Reply" in UI → `inbox-sms-send` when `conversation.channel === 'sms'`. Admin-token protected; sends via Twilio and inserts outbound message.
- **UI:** Already supports SMS; only wire the send action by `conversation.channel` (sms → `inbox-sms-send`, whatsapp → existing `inbox-twilio-send`, email → `inbox-gmail-send`).

**Context:**
- Unified Inbox uses `inbox_conversations` / `inbox_messages` with channels: `email | sms | whatsapp`.
- `inbox-twilio-send` already handles **WhatsApp** (and historically SMS); we introduce **`inbox-sms-send`** for SMS-only outbound and **`twilio-sms-webhook`** for inbound SMS.
- Gmail uses `inbox-gmail-sync` (manual) + `inbox-gmail-send`; Twilio SMS uses webhook (inbound) + `inbox-sms-send` (outbound).

---

## Current State Analysis

### Inbox Data Model

**Table:** `public.inbox_conversations`
- `id`, `channel` (`'email' | 'sms' | 'whatsapp'`), `primary_handle`, `subject`, `status`, `unread_count`, `last_message_at`, `last_message_preview`, `created_at`, `updated_at`.
- For SMS, `primary_handle` = customer phone number (E.164).

**Table:** `public.inbox_messages`
- `id`, `conversation_id`, `channel`, `direction`, `from_handle`, `to_handle`, `body_text`, `subject`, `sent_at`, `status`, `meta` (jsonb), `created_at`, `updated_at`.
- **Meta for SMS (Twilio):** `meta.twilio.MessageSid`, `meta.twilio.AccountSid`, `meta.twilio.From`, `meta.twilio.To`, etc., as needed for idempotency and auditing.

### Existing Edge Functions

- **`inbox-twilio-send`:** Admin-token protected. Sends SMS/WhatsApp via Twilio; inserts outbound `inbox_messages`; updates `inbox_conversations`. Uses `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. WhatsApp uses `whatsapp:` prefix on From/To.
- **`inbox-gmail-send`:** Admin-token protected. Sends email via Gmail API for `channel === 'email'`.
- **`inbox-gmail-sync`:** Manual sync from Gmail → `inbox_*`; idempotency via `meta.gmail.messageId`.

### Frontend

- **`useSendReply`** (useInboxMessages): Routes by `channel` — `email` → `sendGmailReply`, else (sms/whatsapp) → `sendTwilioMessage` (→ `inbox-twilio-send`).
- **ConversationView:** Passes `conversation.channel` into send. UI already supports SMS; we only change routing so `sms` → `inbox-sms-send`.

---

## Deliverables

1. **Supabase Edge Function: `twilio-sms-webhook`** (public)
   - Receives Twilio webhook POST (inbound SMS).
   - Creates or updates `inbox_conversations` (by `primary_handle` + `channel = 'sms'`).
   - Inserts inbound `inbox_messages` with `meta.twilio` (including `MessageSid`).
   - Idempotent: skip insert if message with `meta.twilio.MessageSid` already exists.
   - No admin token; validate Twilio request (optional: Twilio signature) if desired; CORS for webhook unnecessary.

2. **Supabase Edge Function: `inbox-sms-send`** (admin-token protected)
   - Same contract as `inbox-gmail-send` / `inbox-twilio-send`: `POST` with `X-Admin-Token`, body `{ conversation_id, body_text }`.
   - Load conversation; ensure `channel === 'sms'`.
   - Send SMS via Twilio (no `whatsapp:` prefix); insert outbound `inbox_messages`; update `inbox_conversations`.
   - Store `meta.twilio.MessageSid` (and related) on outbound message.

3. **DB migration(s) if needed**
   - **External message id uniqueness:** Support idempotent inbound deduplication by Twilio `MessageSid`. Options:
     - Unique index on `(channel, (meta->'twilio'->>'MessageSid'))` where `meta->'twilio'->>'MessageSid'` is not null; or
     - New column `external_message_id` (e.g. `twilio:MessageSid`) plus unique constraint.
   - **SMS channel account fields:** If we need to store which Twilio number received the SMS (e.g. for multi-number setups), add columns or `meta` usage as required. MVP can use a single `TWILIO_PHONE_NUMBER` env var.

4. **Frontend: route "Send Reply" to `inbox-sms-send` when `conversation.channel === 'sms'`**
   - Add `sendSmsReply` (or equivalent) calling `inbox-sms-send`.
   - In `useSendReply`: `email` → `sendGmailReply`; `sms` → `sendSmsReply`; `whatsapp` → `sendTwilioMessage` (unchanged).

5. **Setup notes**
   - **Twilio Console:** Webhook URL for inbound SMS → `https://<PROJECT_REF>.supabase.co/functions/v1/twilio-sms-webhook` (POST).
   - **Supabase secrets:** `INBOX_ADMIN_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`; `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (existing). Document in `.env.example` / setup docs.

---

## Implementation Approach

### Phase 1: Database (if needed)

- Add unique constraint or index to support idempotency by `MessageSid` (e.g. unique on `meta.twilio.MessageSid` for `channel = 'sms'`, or `external_message_id`).
- Add any SMS-specific account/handler fields if required for MVP.

### Phase 2: Edge Function — `twilio-sms-webhook`

**File:** `supabase/functions/twilio-sms-webhook/index.ts`

- **Public** endpoint; no `X-Admin-Token`. Handle `POST` only (Twilio sends form-urlencoded).
- Parse Twilio params: `MessageSid`, `From`, `To`, `Body`, `AccountSid`, etc.
- **Idempotency:** Query `inbox_messages` for existing row with `meta->'twilio'->>'MessageSid' = MessageSid` (or `external_message_id = 'twilio:' || MessageSid`). If found, return 200 and skip insert.
- **Conversation:** Find or create `inbox_conversations` with `channel = 'sms'` and `primary_handle` = customer phone (From when inbound from customer). Use `To` as our number.
- **Insert message:** `inbox_messages` with `direction = 'inbound'`, `from_handle = From`, `to_handle = To`, `body_text = Body`, `sent_at = now()`, `meta = { twilio: { MessageSid, AccountSid, From, To, ... } }`.
- Update conversation: `last_message_at`, `last_message_preview`, `unread_count` increment.
- Return 200 with TwiML empty response (or minimal) so Twilio doesn’t retry.

### Phase 3: Edge Function — `inbox-sms-send`

**File:** `supabase/functions/inbox-sms-send/index.ts`

- **Protected** by `X-Admin-Token == INBOX_ADMIN_TOKEN`; CORS `POST`/`OPTIONS`.
- Request body: `{ conversation_id, body_text }`. Validate; 400 if invalid, 401 if token missing/wrong.
- Load `inbox_conversations` by `conversation_id`; 404 if missing. Enforce `channel === 'sms'`; 400 otherwise.
- Send SMS via Twilio API (`From` = `TWILIO_PHONE_NUMBER`, `To` = `conversation.primary_handle`, `Body` = trimmed `body_text`).
- On success: insert outbound `inbox_messages` (`direction = 'outbound'`, `from_handle` = our number, `to_handle` = `primary_handle`, `meta.twilio.MessageSid`, etc.); update `inbox_conversations` (`last_message_at`, `last_message_preview`).
- On Twilio failure: optionally insert `inbox_messages` with `status = 'failed'`; return 502.

### Phase 4: Frontend — Send Reply routing

**Files:** `src/modules/inbox/api/inboxSms.api.ts` (new), `src/modules/inbox/hooks/useInboxMessages.ts`

- **`sendSmsReply({ conversationId, bodyText })`:** `POST` to `.../inbox-sms-send` with `X-Admin-Token`, body `{ conversation_id, body_text }`. Throw on non-2xx.
- **`useSendReply`:** Route by `channel`:
  - `email` → `sendGmailReply`
  - `sms` → `sendSmsReply`
  - `whatsapp` → `sendTwilioMessage` (existing)

Ensure `ConversationView` passes `conversation.channel` into the send mutation (already in place).

### Phase 5: Setup notes

- **Twilio Console:** Inbound SMS webhook URL → `https://<PROJECT_REF>.supabase.co/functions/v1/twilio-sms-webhook`. Method: POST.
- **Supabase secrets:** `INBOX_ADMIN_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. Frontend: `VITE_SUPABASE_FUNCTIONS_URL`, `VITE_INBOX_ADMIN_TOKEN`.
- Document in `.env.example` and any runbooks. Restart Vite after env changes.

---

## Idempotency for Inbound Webhooks

- Twilio retries webhooks on non-2xx or timeout. We **must** be idempotent.
- Use **`MessageSid`** as the unique key: before inserting an inbound SMS, check that no `inbox_messages` row exists with `meta.twilio.MessageSid` equal to the incoming `MessageSid` (or equivalent `external_message_id`).
- If it exists, return 200 and do nothing. Otherwise, create conversation (if needed) + message, then 200.

---

## Meta Usage for SMS (Twilio)

Store in `inbox_messages.meta`:

- **Inbound:** `meta.twilio.MessageSid`, `AccountSid`, `From`, `To`, and any other useful Twilio params (e.g. `NumMedia`) for debugging/auditing.
- **Outbound:** `meta.twilio.MessageSid` (and optionally `AccountSid`, `To`) from Twilio send API response.

Use `MessageSid` for idempotency and for future lookups (e.g. status callbacks) if needed.

---

## Acceptance Checklist

- [ ] Inbound SMS to Twilio number → webhook → conversation created or updated, inbound message inserted; duplicate webhooks (same `MessageSid`) do not create duplicate messages.
- [ ] Outbound "Send Reply" in Inbox for `channel === 'sms'` → `inbox-sms-send` → SMS sent via Twilio, outbound message stored.
- [ ] WhatsApp and email flows unchanged: `whatsapp` → `inbox-twilio-send`, `email` → `inbox-gmail-send`.
- [ ] Twilio metadata stored in `inbox_messages.meta` for both inbound and outbound.
- [ ] Setup notes document Twilio webhook URL and required Supabase secrets.
- [ ] Build passes; no regressions.

---

## File-Level Summary

| Deliverable | Action | Path |
|-------------|--------|------|
| Webhook | Create | `supabase/functions/twilio-sms-webhook/index.ts` |
| SMS send | Create | `supabase/functions/inbox-sms-send/index.ts` |
| DB | Migrate | `supabase/migrations/...` (if needed for MessageSid uniqueness / sms account fields) |
| API helper | Create | `src/modules/inbox/api/inboxSms.api.ts` |
| Send routing | Update | `src/modules/inbox/hooks/useInboxMessages.ts` |
| Setup | Update | `.env.example` (and any setup docs) |

---

**Branch:** `feature/twilio-sms-inbox-integration`  
**Spec version:** 1.0
