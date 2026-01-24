# Tasks: Twilio SMS Inbox (Inbound + Outbound)

**Spec:** `specs/implement twilio sms integration for unified inbox - inbound outbound.md`  
**Decisions:** `plans/twilio-sms-inbox/decisions.md`  
**Branch:** `feature/twilio-sms-inbox-integration`

---

## Task Summary

| # | Task | Type | File(s) | Phase |
|---|------|------|---------|-------|
| 1.1 | DB review + migration: `external_message_id`, `external_thread_id` | Create | `supabase/migrations/...` | 1 |
| 2.1 | Edge Function: `twilio-sms-webhook` shell, form-urlencoded parsing | Create | `supabase/functions/twilio-sms-webhook/index.ts` | 2 |
| 2.2 | Webhook: conversation find-or-create by `external_thread_id` | Create | same | 2 |
| 2.3 | Webhook: idempotency by `external_message_id`, insert message, update conversation | Create | same | 2 |
| 3.1 | Edge Function: `inbox-sms-send` auth, validation, Twilio send | Create | `supabase/functions/inbox-sms-send/index.ts` | 3 |
| 3.2 | inbox-sms-send: insert outbound message, update conversation | Create | same | 3 |
| 4.1 | Frontend: `inboxSms.api` + `sendSmsReply` | Create | `src/modules/inbox/api/inboxSms.api.ts` | 4 |
| 4.2 | Frontend: route SMS in `useSendReply` to `sendSmsReply` | Update | `src/modules/inbox/hooks/useInboxMessages.ts` | 4 |
| 5.1 | Setup checklist: secrets, webhook URL, local dev | Doc | `.env.example`, plan docs | 5 |

---

## Phase 1: Database

### Task 1.1: DB review + migration

**Description:**

1. **Review:** Confirm `inbox_messages` has no `external_message_id`; confirm `inbox_conversations` has no `external_thread_id`. (See decisions: we add both.)
2. **Migration:** Create `supabase/migrations/YYYYMMDDHHMMSS_add_external_message_id_and_external_thread_id.sql`:
   - `inbox_messages`: add `external_message_id text`; add **unique partial index** on `(external_message_id)` where `external_message_id is not null` to enforce dedupe. Add comment.
   - `inbox_conversations`: add `external_thread_id text`; add partial index on `(channel, external_thread_id)` where `external_thread_id is not null` for fast find-or-create. Add comment.

**Acceptance:**

- [ ] Migration runs without error.
- [ ] Existing rows unchanged; new columns nullable.
- [ ] Idempotent (e.g. `add column if not exists`).

**References:** `plans/twilio-sms-inbox/decisions.md` § 1, 2.

---

## Phase 2: Edge Function — `twilio-sms-webhook`

### Task 2.1: Webhook shell + form-urlencoded parsing

**File:** `supabase/functions/twilio-sms-webhook/index.ts`

**Description:**

1. `Deno.serve` handler. Accept `POST` only; return `405` for other methods. No CORS needed for Twilio webhook (they POST to our URL).
2. **Content-Type:** Twilio sends `application/x-www-form-urlencoded`. Do **not** use `req.json()`. Read body via `req.text()`, then parse with `URLSearchParams` (or equivalent).
3. Extract: `MessageSid`, `AccountSid`, `From`, `To`, `Body`, `NumMedia` (optional). `MessagingServiceSid` optional for future use.
4. Validate required: `MessageSid`, `From`, `To`, `Body` (Body can be empty string). Return `400` if missing.
5. Return `200` with minimal TwiML `<Response></Response>` so Twilio doesn’t retry. Use `Content-Type: text/xml` or `application/xml` for TwiML.

**Acceptance:**

- [ ] POST with form-urlencoded body parsed correctly.
- [ ] Missing required params → `400`.
- [ ] Success → `200` + empty TwiML.

**References:** Twilio webhook docs; decisions § 4 (signature verification deferred). **Follow-up:** Add `X-Twilio-Signature` validation using Twilio RequestValidator + raw body + `TWILIO_AUTH_TOKEN` when ready.

---

### Task 2.2: Conversation find-or-create by `external_thread_id`

**Description:**

1. Compute **canonical** `external_thread_id = [From, To].sort().join('|')` (both E.164-style; ensure stable order).
2. **Find:** `SELECT id FROM inbox_conversations WHERE channel = 'sms' AND external_thread_id = $1 LIMIT 1`.
3. **Create if not found:** `INSERT INTO inbox_conversations (channel, primary_handle, external_thread_id, status, unread_count, last_message_at, last_message_preview, ...) VALUES ('sms', From, $external_thread_id, 'open', 0, now(), left(Body,120), ...)`. Use `From` as `primary_handle` (customer).
4. Ensure `To` is stored (e.g. in meta or conversation) if needed for later; MVP can rely on `TWILIO_PHONE_NUMBER` for outbound.

**Acceptance:**

- [ ] Existing SMS thread reused by `external_thread_id`.
- [ ] New thread created when none exists.
- [ ] `primary_handle` = customer phone (From).

**References:** decisions § 2.

---

### Task 2.3: Idempotency, insert message, update conversation

**Description:**

1. **Idempotency:** Set `external_message_id = 'twilio:' || MessageSid`. Before insert, `SELECT id FROM inbox_messages WHERE external_message_id = $1`. If found, **skip insert**, update conversation timestamps if desired (optional), return `200` + TwiML. This ensures Twilio retries are safe.
2. **Insert message:** `INSERT INTO inbox_messages (conversation_id, channel, direction, from_handle, to_handle, body_text, sent_at, status, external_message_id, meta) VALUES (..., 'inbound', From, To, Body, now(), 'sent', 'twilio:'||MessageSid, jsonb_build_object('twilio', { MessageSid, AccountSid, From, To, ... }))`.
3. **Update conversation:** Set `last_message_at`, `last_message_preview`; increment `unread_count` for inbound when `status = 'open'`. Match existing Gmail sync pattern.

**Acceptance:**

- [ ] Duplicate webhook (same MessageSid) does not create duplicate message.
- [ ] New message stored with `external_message_id` and `meta.twilio`.
- [ ] Conversation metadata updated.

**References:** decisions § 1; spec “Idempotency for Inbound Webhooks”.

---

## Phase 3: Edge Function — `inbox-sms-send`

### Task 3.1: Auth, validation, Twilio send

**File:** `supabase/functions/inbox-sms-send/index.ts`

**Description:**

1. **CORS:** Same as `inbox-gmail-send` / `inbox-twilio-send`: `POST`, `OPTIONS`; standard headers including `x-admin-token`.
2. **Auth:** Require `X-Admin-Token == INBOX_ADMIN_TOKEN`; `401` if missing or invalid.
3. **Body:** Parse JSON `{ conversation_id, body_text }`. Validate both present and non-empty `body_text`; `400` otherwise.
4. **Load conversation:** `SELECT id, channel, primary_handle FROM inbox_conversations WHERE id = $1`. If not found, `404`. If `channel !== 'sms'`, `400`.
5. **Twilio:** Use `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. `From` = `TWILIO_PHONE_NUMBER`, `To` = `primary_handle`, `Body` = trimmed `body_text`. No `whatsapp:` prefix. POST to Twilio Messages API.
6. On Twilio error: optionally insert `inbox_messages` with `status = 'failed'`; return `502` with generic error.

**Acceptance:**

- [ ] Token check; `401` on fail.
- [ ] Invalid or missing body → `400`.
- [ ] Non-SMS conversation → `400`.
- [ ] SMS sent via Twilio when valid.

**References:** decisions § 5, 6; `inbox-twilio-send` pattern.

---

### Task 3.2: Insert outbound message, update conversation

**Description:**

1. On **Twilio success:** Parse response for `MessageSid`. Insert `inbox_messages`: `conversation_id`, `channel = 'sms'`, `direction = 'outbound'`, `from_handle` = our number, `to_handle` = `primary_handle`, `body_text`, `sent_at`, `status = 'sent'`, `external_message_id = 'twilio:' || MessageSid`, `meta = { twilio: { MessageSid, AccountSid, To } }`.
2. Update `inbox_conversations`: `last_message_at`, `last_message_preview`, `updated_at`.
3. Return `200` with `{ success: true, message_id, twilio_sid }` (match existing send responses).

**Acceptance:**

- [ ] Outbound message persisted with `meta.twilio`.
- [ ] Conversation timestamps updated.

---

## Phase 4: Frontend

### Task 4.1: `inboxSms.api` + `sendSmsReply`

**File:** `src/modules/inbox/api/inboxSms.api.ts`

**Description:**

1. `sendSmsReply({ conversationId, bodyText })`: POST to `VITE_SUPABASE_FUNCTIONS_URL/inbox-sms-send` with `X-Admin-Token`, `Content-Type: application/json`, body `{ conversation_id: conversationId, body_text: bodyText }`.
2. Validate `VITE_SUPABASE_FUNCTIONS_URL` and `VITE_INBOX_ADMIN_TOKEN`; throw if missing.
3. On non-2xx: parse JSON error; throw with message.
4. Return `{ success: true, message_id?, twilio_sid? }` (align with `inboxTwilio.api` response shape).

**Acceptance:**

- [ ] Helper implemented; env validated.
- [ ] Request/response match `inbox-sms-send` contract.

---

### Task 4.2: Route SMS in `useSendReply` to `sendSmsReply`

**File:** `src/modules/inbox/hooks/useInboxMessages.ts`

**Description:**

1. **Current behavior:** `email` → `sendGmailReply`; else (sms/whatsapp) → `sendTwilioMessage` (→ `inbox-twilio-send`).
2. **New behavior:** `email` → `sendGmailReply`; `sms` → `sendSmsReply`; `whatsapp` → `sendTwilioMessage`. Add `sendSmsReply` import and branch for `channel === 'sms'`.
3. Keep existing invalidation (messages, conversations list, conversation detail) on success.

**Acceptance:**

- [ ] SMS conversations use `inbox-sms-send` via `sendSmsReply`.
- [ ] WhatsApp still uses `sendTwilioMessage`; email unchanged.

**References:** `ConversationView` passes `conversation.channel`; no change needed there.

---

## Phase 5: Setup Checklist

### Task 5.1: Setup checklist

**Description:**

Document the following:

1. **Supabase secrets**
   - `INBOX_ADMIN_TOKEN`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (existing)

2. **Twilio Console**
   - Inbound SMS webhook URL: `https://<PROJECT_REF>.supabase.co/functions/v1/twilio-sms-webhook`
   - Method: POST

3. **Frontend env**
   - `VITE_SUPABASE_FUNCTIONS_URL`
   - `VITE_INBOX_ADMIN_TOKEN`

4. **Local dev / testing**
   - Run migrations (`supabase db push` or equivalent).
   - Set secrets; deploy or serve `twilio-sms-webhook` and `inbox-sms-send`.
   - Use Twilio phone number for inbound; send test SMS, confirm webhook creates conversation + message.
   - In app: open SMS conversation, send reply; confirm outbound via `inbox-sms-send` and Twilio.
   - Optional: use ngrok or similar to expose local webhook URL for Twilio during dev.

**Deliverables:**

- [X] `.env.example` updated with Twilio-related vars and short comments.
- [X] Brief setup section in `plans/twilio-sms-inbox/quickstart.md` linking to this checklist.

---

## Progress Tracking

### Phase 1
- [X] Task 1.1: DB review + migration

### Phase 2
- [X] Task 2.1: Webhook shell + form-urlencoded parsing
- [X] Task 2.2: Conversation find-or-create by external_thread_id
- [X] Task 2.3: Idempotency, insert message, update conversation

### Phase 3
- [X] Task 3.1: inbox-sms-send auth, validation, Twilio send
- [X] Task 3.2: Insert outbound message, update conversation

### Phase 4
- [X] Task 4.1: inboxSms.api + sendSmsReply
- [X] Task 4.2: Route SMS in useSendReply

### Phase 5
- [X] Task 5.1: Setup checklist

---

## File-Level Summary

| Deliverable | Action | Path |
|-------------|--------|------|
| Migration | Create | `supabase/migrations/..._add_external_message_id_and_external_thread_id.sql` |
| Webhook | Create | `supabase/functions/twilio-sms-webhook/index.ts` |
| SMS send | Create | `supabase/functions/inbox-sms-send/index.ts` |
| API helper | Create | `src/modules/inbox/api/inboxSms.api.ts` |
| Send routing | Update | `src/modules/inbox/hooks/useInboxMessages.ts` |
| Setup | Update | `.env.example` |
