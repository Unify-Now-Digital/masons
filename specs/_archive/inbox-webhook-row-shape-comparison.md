# Inbox webhook row-shape comparison: old vs twilio-sms-webhook

The old `inbox-twilio-inbound` function is not in the repo (replaced by `twilio-sms-webhook`). This comparison is based on the spec, RLS migration, and other inbox functions (inbox-sms-send, inbox-gmail-sync, inbox-twilio-send).

---

## 1. inbox_messages INSERT

| Field | Spec / old (inferred) | twilio-sms-webhook current |
|-------|------------------------|-----------------------------|
| conversation_id | ✓ set | ✓ set |
| channel | ✓ | ✓ (sms \| whatsapp) |
| direction | 'inbound' | 'inbound' |
| from_handle | From (customer) | from.trim() ✓ |
| to_handle | To (our number) | to.trim() ✓ |
| body_text | Body | body ✓ |
| sent_at | now() | sentAt (ISO) ✓ |
| status | — | 'sent' ✓ |
| meta | twilio: { MessageSid, AccountSid, From, To, ... } | twilio: { MessageSid, AccountSid, From, To, NumMedia, MessagingServiceSid, channel } ✓ |
| external_message_id | (idempotency) | twilio:MessageSid ✓ |
| user_id | (pre-RLS: omitted/NULL) | ownerUserId ✓ (required for RLS visibility) |
| whatsapp_connection_id | — | connectionId when WhatsApp ✓ |

**Difference:** Old/legacy inserts likely omitted `user_id` (NULL). With RLS, rows with `user_id` NULL are hidden. Current webhook correctly sets `user_id` so the owner sees the message. No change needed.

---

## 2. inbox_conversations INSERT (new conversation)

| Field | Spec / old (inferred) | twilio-sms-webhook current |
|-------|------------------------|-----------------------------|
| channel | ✓ | ✓ |
| primary_handle | customer phone (From) | primaryHandle (from.trim()) ✓ |
| external_thread_id | — | set (canonical From\|To) ✓ |
| subject | null | null ✓ |
| status | 'open' | 'open' ✓ |
| unread_count | 1 (inbound) | 1 ✓ |
| last_message_at | sentAt | sentAt ✓ |
| last_message_preview | body slice | preview (body.slice(0,120)) ✓ |
| user_id | (pre-RLS: omitted) | ownerUserId ✓ |
| **updated_at** | (often default now()) | **not set on INSERT** |

**Difference:** New conversation INSERT does not set `updated_at`. The row is then updated in the same request (last_message_at, last_message_preview, updated_at), so after the webhook completes the row has `updated_at` set. If a client or Realtime read happens between INSERT and UPDATE (unlikely but possible), or if the frontend expects `updated_at` to be non-null for sort/display, the row shape would differ from the “always-set” behavior. Setting `updated_at` on INSERT makes the row complete from the first write and matches the update path.

---

## 3. inbox_conversations UPDATE (existing or just-created)

| Field | Spec / old | twilio-sms-webhook current |
|-------|------------|-----------------------------|
| last_message_at | set to sentAt | sentAt ✓ |
| last_message_preview | body slice | preview ✓ |
| updated_at | — | sentAt ✓ |
| unread_count | increment for existing | (existingConv.unread_count ?? 0) + 1 ✓ |

No difference; behavior matches.

---

## 4. Fields that affect UI (filter/sort/group)

- **status:** both use `'open'`. Frontend filters `status = 'open'`. ✓
- **user_id:** webhook sets it; RLS `user_id = auth.uid()` so owner sees the row. ✓
- **last_message_at:** set on INSERT (new conv) and UPDATE. List sorted by `last_message_at DESC`. ✓
- **unread_count:** set/incremented. ✓
- **primary_handle:** set; used for display and linking. ✓
- **updated_at:** set on UPDATE; not set on new-conversation INSERT. Frontend type expects `updated_at: string`. Setting it on INSERT avoids null and keeps row shape consistent.

---

## 5. Most likely cause of delayed UI behavior

Not a missing field on the webhook side: payloads and RLS are correct. The remaining inconsistency is **new conversation INSERT omitting `updated_at`**. That can leave the row with `updated_at` null until the subsequent UPDATE runs. Any code (e.g. Realtime, triggers, or a fast refetch) that expects `updated_at` to be set for “last activity” could treat the row as stale or not-yet-ready. Setting `updated_at` on the new-conversation INSERT aligns the row with the update path and with the frontend type, and avoids depending on the UPDATE running first.

---

## 6. Minimal code change

In `twilio-sms-webhook`, on **new conversation INSERT**, set `updated_at: sentAt` (same value as `last_message_at`) so the row has a complete, consistent shape from the first write.
