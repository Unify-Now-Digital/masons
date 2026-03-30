# Data model: whatsapp_connections and inbox attribution

## New table: public.whatsapp_connections

One row per user; one *active* connection per user (enforced by unique partial index).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| id | uuid | NO | PK, default gen_random_uuid() |
| company_id | uuid | YES | FK to public.companies if table exists; else no FK, comment only |
| user_id | uuid | NO | FK auth.users(id) ON DELETE CASCADE |
| provider | text | NO | default 'twilio' |
| twilio_account_sid | text | NO | |
| twilio_api_key_sid | text | NO | |
| twilio_api_key_secret_encrypted | text | NO | Encrypted; never plaintext |
| whatsapp_from | text | NO | E.164 or whatsapp:+...; normalize consistently |
| status | text | NO | 'active' \| 'disconnected' \| 'error' \| 'pending_validation'; default 'pending_validation' |
| last_error | text | YES | Last validation/send error |
| last_validated_at | timestamptz | YES | |
| disconnected_at | timestamptz | YES | Set on disconnect for audit |
| created_at | timestamptz | NO | default now() |
| updated_at | timestamptz | NO | default now() |

**Indexes:**

- `create unique index idx_whatsapp_connections_one_active_per_user on public.whatsapp_connections (user_id) where status = 'active';`
- `create index idx_whatsapp_connections_user_id on public.whatsapp_connections (user_id);`
- `create index idx_whatsapp_connections_twilio_lookup on public.whatsapp_connections (twilio_account_sid, whatsapp_from) where status = 'active';`

**RLS:** Enable; policies: select/insert/update/delete for authenticated where user_id = auth.uid(). No anon.

---

## Inbox attribution: inbox_messages.whatsapp_connection_id

- Add column: `whatsapp_connection_id uuid references public.whatsapp_connections(id) on delete set null`.
- Nullable. Set on both inbound and outbound WhatsApp messages when connection is known.
- Index: `create index idx_inbox_messages_whatsapp_connection_id on public.inbox_messages (whatsapp_connection_id);`

---

## Owner column (no change)

- `inbox_conversations.user_id` and `inbox_messages.user_id` already exist and are used as owner. Do not add owner_user_id. Webhook and send must set these when creating/updating rows.
