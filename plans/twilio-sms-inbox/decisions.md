# Twilio SMS Inbox — Key Decisions

**Spec:** `specs/implement twilio sms integration for unified inbox - inbound outbound.md`  
**Branch:** `feature/twilio-sms-inbox-integration`

---

## 1. DB Review: Deduplication Strategy

### 1.1 Does `inbox_messages` have `external_message_id`?

**Finding:** No. The current schema (from types + Gmail sync usage) has `inbox_messages` with `meta` (jsonb) but **no** `external_message_id` column. Gmail dedupes by scanning recent messages and checking `meta.gmail.messageId` (no unique constraint).

### 1.2 Dedupe via `external_message_id` (preferred) vs `meta.twilio.MessageSid`

**Decision:** **Prefer `external_message_id`.**

| Approach | Pros | Cons |
|----------|------|------|
| **`external_message_id`** | Explicit column; simple unique constraint; index-friendly; reusable for other channels (e.g. `gmail:msgId`) | Requires migration; one-time schema change |
| **`meta.twilio.MessageSid`** | No new column; matches Gmail’s meta-based pattern | JSONB expression indexes; slightly more complex queries; meta shape varies by channel |

**Implementation:** Add `external_message_id text` to `inbox_messages`, unique where not null. For SMS inbound, set `external_message_id = 'twilio:' || MessageSid`. Idempotency: `SELECT` by `external_message_id` before insert; optionally `INSERT ... ON CONFLICT (external_message_id) DO NOTHING` if we use a unique constraint.

### 1.3 If using `meta` instead: index strategy

If we **do not** add `external_message_id`, use **expression index** for fast dedupe:

```sql
-- Partial unique index for SMS deduplication by MessageSid
create unique index if not exists idx_inbox_messages_twilio_message_sid
  on public.inbox_messages ((meta->'twilio'->>'MessageSid'))
  where channel = 'sms' and meta->'twilio'->>'MessageSid' is not null;
```

- Enforces at most one row per `meta.twilio.MessageSid` for `channel = 'sms'`.
- Enables fast lookup by MessageSid for idempotency check.
- **Downside:** Insert must include full `meta`; conflict handling is on the expression.

**Conclusion:** We use **`external_message_id`**; no expression index on `meta` for MVP.

---

## 2. Conversation Key: `external_thread_id`

**Decision:** Use **`external_thread_id = ${From}|${To}`** (canonical order) for SMS conversation identity.

- **From** = customer number (inbound sender).
- **To** = our Twilio number that received the SMS.
- Use a **canonical** form: e.g. sort `[From, To]` and join with `|` so that the same thread is used regardless of which number is “From” vs “To” in subsequent messages (e.g. outbound). For **inbound-only** MVP, `From|To` is enough; we can refine later if we support multi-number or two-way init.

**Schema:** Add `external_thread_id text` to `inbox_conversations`. For SMS, find-or-create by `(channel = 'sms', external_thread_id = canonical_thread_id)`.

**Migration:** Add `external_thread_id`; optional unique partial index `(channel, external_thread_id)` where not null for efficient lookups.

---

## 3. Channel Account Resolution (`inbox_channel_accounts`)

**Decision:** **Defer to post-MVP.** Use a single `TWILIO_PHONE_NUMBER` env var for MVP.

- `InboxChannelAccount` exists in frontend types (`channel`, `account_identifier`, `connection_metadata`), but there is no migration or usage for `inbox_channel_accounts` in the codebase yet.
- **Post-MVP:** Resolve `channel_account_id` by matching webhook `To` to `inbox_channel_accounts` (e.g. `connection_metadata->>'twilio_phone_number'` or `messaging_service_sid`). MVP skips this.
- **MVP:** All SMS uses `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. From number = `TWILIO_PHONE_NUMBER`; no Messaging Service.

---

## 4. Twilio Signature Verification (Webhook)

**Decision:** **Do not include in MVP.** Document how to add it later.

- Twilio sends `X-Twilio-Signature`; validation uses raw body + auth token + URL (see [Twilio Security](https://www.twilio.com/docs/usage/security)).
- **MVP:** Webhook is public; no signature check. Rely on HTTPS, obscurity of URL, and idempotency. Add validation in a follow-up task.
- **Follow-up:** Use Twilio’s `validateRequest` (or equivalent) in `twilio-sms-webhook`; require `TWILIO_AUTH_TOKEN`; parse raw body only for validation, then parse form for processing.

---

## 5. From Number / Messaging Service (Outbound)

**Decision:** **MVP uses a single From number** from `TWILIO_PHONE_NUMBER`. No Messaging Service, no `inbox_channel_accounts` lookup.

- Same pattern as `inbox-twilio-send`: `From` = `TWILIO_PHONE_NUMBER`, `To` = `conversation.primary_handle`.
- **Later:** Support Messaging Service SID or per-conversation From (e.g. via `channel_account_id`) if needed.

---

## 6. Request Body Shape (`inbox-sms-send`)

**Decision:** **Match existing send functions:** `{ conversation_id, body_text }` (snake_case).

- `inbox-gmail-send` and `inbox-twilio-send` use `conversation_id` + `body_text`. Frontend sends `conversation_id` and `body_text` (see `inboxTwilio.api`, `inboxGmail.api`).
- **`inbox-sms-send`** uses the same. No `conversationId` / `body` camelCase in the API; keep frontend helpers’ internal args as `conversationId` / `bodyText` and map to `conversation_id` / `body_text` in the request body.

---

## Summary

| Topic | Decision |
|-------|----------|
| **Dedupe** | `external_message_id` (preferred). Add column; use `twilio:MessageSid`. |
| **Index** | Unique constraint on `external_message_id`. If we used meta only: partial unique expression index on `(meta->'twilio'->>'MessageSid')` for `channel = 'sms'`. |
| **Conversation key** | `external_thread_id = ${From}|${To}` (canonical); add column to `inbox_conversations`. |
| **Channel account** | MVP: skip. Single `TWILIO_PHONE_NUMBER`. Post-MVP: match `To` to `inbox_channel_accounts`. |
| **Signature verification** | Exclude from MVP; document how to add. |
| **From number** | Single `TWILIO_PHONE_NUMBER`; no Messaging Service in MVP. |
| **Request body** | `{ conversation_id, body_text }` (same as Gmail/Twilio send). |
