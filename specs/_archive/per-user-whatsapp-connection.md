# Per-user WhatsApp connection (Twilio credentials)

**Status:** Specification  
**Context:** Mason App uses Supabase, RLS, Edge Functions, React, TypeScript. Inbox is per-user. Gmail is already connected per user. WhatsApp currently works only through existing test Twilio Sandbox functions (`inbox-twilio-send`, Twilio webhook). This spec adds per-user WhatsApp lines via stored Twilio credentials, with historical conversations preserved read-only after disconnect.

---

## 1. Exact migration plan

### 1.1 New table: `public.whatsapp_connections`

One row per user. One active connection per user (enforced by unique partial index).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | uuid | NO | PK, `gen_random_uuid()` |
| `company_id` | uuid | YES | Optional; FK to `public.companies` if table exists, else no FK |
| `user_id` | uuid | NO | FK `auth.users(id) ON DELETE CASCADE` |
| `provider` | text | NO | Default `'twilio'` |
| `twilio_account_sid` | text | NO | Twilio Account Sid |
| `twilio_api_key_sid` | text | NO | Twilio API Key SID (not main account auth) |
| `twilio_api_key_secret_encrypted` | text | NO | Encrypted secret; see Security section |
| `whatsapp_from` | text | NO | E.164 or `whatsapp:+...` format; used as From for WhatsApp |
| `status` | text | NO | `'active' \| 'disconnected' \| 'error' \| 'pending_validation'`, default `'pending_validation'` |
| `last_error` | text | YES | Last validation or send error message |
| `last_validated_at` | timestamptz | YES | Last successful validation/test |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

- Unique partial index: one active per user  
  `create unique index idx_whatsapp_connections_one_active_per_user on public.whatsapp_connections (user_id) where status = 'active';`
- Index: `create index idx_whatsapp_connections_user_id on public.whatsapp_connections (user_id);`
- Lookup for webhook routing: `create index idx_whatsapp_connections_twilio_lookup on public.whatsapp_connections (twilio_account_sid, whatsapp_from) where status = 'active';`
- Enable RLS; policies below.

### 1.2 Inbox tables: owner column

- **Existing state:** `inbox_conversations` and `inbox_messages` already have `user_id` (owner) and RLS in `20260218130000_add_user_id_to_inbox_tables_rls.sql`. No new column required. The requirement “Add owner_user_id” is satisfied by using this existing `user_id` as the owner; no new column name introduced.
- **Optional:** If product prefers a clearer name, add a migration that adds `owner_user_id` as a generated column or synonym; otherwise treat `user_id` as owner everywhere.
- **Backfill:** See §5.

### 1.3 Optional: `whatsapp_connection_id` on `inbox_messages`

- Add `whatsapp_connection_id uuid references public.whatsapp_connections(id) on delete set null` to `inbox_messages` (nullable).
- Enables “which WhatsApp line” attribution per message; optional for v1.

### 1.4 Migration file order

1. `YYYYMMDDHHmmss_create_whatsapp_connections.sql`  
   - Create `whatsapp_connections`, indexes, RLS policies.  
   - If `companies` exists, add FK for `company_id`; else leave `company_id` without FK and add comment.
2. `YYYYMMDDHHmmss_add_whatsapp_connection_id_to_inbox_messages.sql` (optional)  
   - Add `whatsapp_connection_id` to `inbox_messages` and index.

---

## 2. RLS policies

### 2.1 `public.whatsapp_connections`

- **Select:** Authenticated users see only their own row:  
  `using (user_id = (select auth.uid()))`
- **Insert:** Authenticated users can insert only for themselves:  
  `with check (user_id = (select auth.uid()))`
- **Update:** Authenticated users can update only their own row:  
  `using (user_id = (select auth.uid()))` and `with check (user_id = (select auth.uid()))`
- **Delete:** Authenticated users can delete only their own row:  
  `using (user_id = (select auth.uid()))`

No anon access. Edge Functions use the service role and bypass RLS.

### 2.2 `public.inbox_conversations` and `public.inbox_messages`

- Already restricted by `user_id = (select auth.uid())` for SELECT (and update where applicable). Ensure INSERT is only via service role or a dedicated policy that sets `user_id` from authenticated context; no client INSERT that would allow setting another user’s `user_id`.
- No policy changes required for “users only see their own inbox” if current RLS already enforces `user_id = auth.uid()`.

---

## 3. Edge function change list

### 3.1 Twilio inbound webhook (current: `twilio-sms-webhook` or `inbox-twilio-inbound`)

- **Routing:**  
  - Read Twilio params `AccountSid` and `To` (normalize to same format as stored, e.g. E.164 or `whatsapp:+...`).  
  - Query `whatsapp_connections` with `twilio_account_sid = AccountSid`, `whatsapp_from` matching `To`, and `status = 'active'`.  
  - If no row: either ignore message (return 200 empty TwiML) or respond with a single “no connection” response per product; do not create conversation without owner.
- **Owner and linking:**  
  - Set `user_id` to `whatsapp_connections.user_id` on both new and existing `inbox_conversations` and on every `inbox_messages` insert for this webhook.  
  - Optional: set `whatsapp_connection_id` on `inbox_messages` if column exists.
- **Customer linking:**  
  - Keep auto-link by normalized phone to `customers` only: match `customers.phone` (or equivalent) to normalized From; set `inbox_conversations.person_id` to `customers.id` when exactly one match. Never use `people.id`; use `customers.id` only.
- **Backward compatibility:**  
  - If no `whatsapp_connections` row matches, existing Sandbox behavior can remain for a transition period (e.g. create conversation with `user_id` NULL so RLS hides it, or map to a single “sandbox” user if desired). Prefer routing only to connected users and returning 200 without creating data when no connection is found.

### 3.2 Outbound send (current: `inbox-twilio-send`)

- **Auth:**  
  - Require Supabase JWT (Bearer) for the request. Resolve `auth.uid()` from the JWT. Do not rely only on `x-admin-token` for per-user send; either remove it for this path or keep only for backward compatibility with a single global Sandbox user.
- **Load credentials:**  
  - From `inbox_conversations` get `conversation_id` and ensure the conversation’s `user_id` equals `auth.uid()` (user can only send in their own conversation).  
  - Load that user’s active WhatsApp connection:  
    `select * from whatsapp_connections where user_id = auth.uid() and status = 'active' limit 1`.  
  - If none: return 403 with message that user must connect WhatsApp in Profile.
- **Decrypt and send:**  
  - Decrypt `twilio_api_key_secret_encrypted` using the same mechanism used when storing (Vault or app-level key).  
  - Use Twilio API with `twilio_account_sid`, `twilio_api_key_sid`, decrypted secret (API key auth, not main account auth token if different).  
  - Use `whatsapp_from` as From; format To as `whatsapp:+...` for WhatsApp.  
  - Insert outbound `inbox_messages` with `user_id` set to the authenticated user; optionally set `whatsapp_connection_id`.
- **Compatibility:**  
  - Support both Sandbox (test credentials) and production senders via the same table; no code path that assumes a single env-based Twilio number.

### 3.3 New or updated Edge Functions (summary)

| Function | Change |
|----------|--------|
| Twilio webhook (`twilio-sms-webhook` / `inbox-twilio-inbound`) | Route by AccountSid + To → `whatsapp_connections.user_id`; set `user_id` (and optional `whatsapp_connection_id`) on conversation/message; customer link by `customers.id` only. |
| `inbox-twilio-send` | Auth via JWT; load user’s `whatsapp_connections`; decrypt secret; send using connection’s From; set `user_id` on inserted message. |
| Optional: `whatsapp-validate` or `whatsapp-test` | New function called from Profile to test connection (e.g. send a test message or validate credentials). Uses same decrypt + Twilio API. |

---

## 4. Frontend component change list

- **Profile / Settings (WhatsApp block)**  
  - **Status:** Show connection status: not connected, pending validation, active, error (with optional `last_error`).  
  - **Connected sender:** When active, show `whatsapp_from` (masked if desired).  
  - **Actions:** Connect, Replace, Disconnect, Test.  
    - Connect: open a form to enter Twilio Account SID, API Key SID, API Key Secret, WhatsApp From number; submit to Edge Function or RPC that validates and inserts/updates `whatsapp_connections` (secret stored encrypted server-side only).  
    - Replace: same as Connect but after confirming; ensure one active per user (update existing or insert new and set previous to `disconnected`).  
    - Disconnect: set `status = 'disconnected'`; do not delete row so history can stay associated; clarify in UI that past conversations remain visible but sending/receiving stops.  
    - Test: call test Edge Function that sends a test message using current credentials.  
  - Follow the same UX pattern as Gmail (e.g. `GmailConnectionPanel` / `GmailConnectionStatus`): card with status and actions.
- **Unified Inbox**  
  - Ensure inbox queries already filter by `user_id = auth.uid()` (or equivalent). No change if RLS and API already enforce per-user.  
  - When opening a WhatsApp conversation, send action should call `inbox-twilio-send` with the user’s JWT; no change to conversation list UI beyond ensuring only own conversations show.
- **Hooks / API**  
  - `useWhatsAppConnection()`: fetch current user’s `whatsapp_connections` row(s) (e.g. single active or latest).  
  - `useWhatsAppConnect()`, `useWhatsAppDisconnect()`, `useWhatsAppTest()`: mutations that call Edge Functions or Supabase RPCs.  
  - Do not send API Key Secret from client; only SID, Key SID, and From; secret is entered once and stored encrypted server-side.

---

## 5. Backfill for `user_id` (owner)

- **Goal:** Existing inbox rows with `user_id` NULL are hidden by RLS. To assign an owner so they become visible:
  - Option A: Leave as-is (legacy rows stay hidden).  
  - Option B: Backfill `user_id` for conversations/messages that can be attributed to a user (e.g. Twilio Sandbox → single “sandbox” user, or first user in the app).  
- **If backfilling:**  
  - Single migration or script: `update inbox_conversations set user_id = :sandbox_user_id where user_id is null and channel in ('whatsapp','sms');` and same for `inbox_messages` where `user_id is null` and `conversation_id` in those conversations.  
  - Decide `sandbox_user_id` (e.g. from env or a well-known user). Document in migration comment.  
- **Spec decision:** Prefer no backfill unless product explicitly wants legacy Sandbox data visible to one user; otherwise new traffic is per-user and old stays hidden.

---

## 6. Security notes for credential encryption

- **Storage:** Store only the encrypted value in `twilio_api_key_secret_encrypted`. Never store the raw secret in the table or in logs.
- **Options:**  
  1. **Supabase Vault (pgsodium):** Use `pgsodium` extension and `vault.secrets` or a dedicated table with `pgsodium`-encrypted column; key derived from a secret in Supabase project env. Edge Functions decrypt via a DB function that returns the secret only to the service role.  
  2. **Application-level encryption:** In the Edge Function that receives the secret on connect: encrypt with a key from env (e.g. `WHATSAPP_SECRET_ENCRYPTION_KEY`, 32-byte base64), store ciphertext in `twilio_api_key_secret_encrypted`; decrypt in send/validate functions using the same key. Use AEAD (e.g. AES-256-GCM) and a random IV per row.  
- **Access:** Only Edge Functions (service role) should read and decrypt. Client must never receive the decrypted secret or the encryption key.  
- **Audit:** Optionally log “connection used for send” (e.g. `whatsapp_connection_id`) without logging the secret.  
- **Rotation:** If the encryption key is rotated, re-encrypt all rows with the new key in a migration or one-off job.

---

## 7. Compatibility: Sandbox vs production

- **Same schema:** Twilio Sandbox and production senders both use `whatsapp_connections`; `whatsapp_from` can be a Sandbox number (e.g. Twilio’s) or a production WhatsApp-enabled number.  
- **Webhook URL:** Each Twilio number/sandbox has one webhook URL; that URL is the same Edge Function. The function distinguishes by (AccountSid, To) and finds the matching `whatsapp_connections` row.  
- **Testing:** Users can add Sandbox credentials in Profile; later replace with production credentials without schema change.

---

## 8. Disconnect behavior (historical data)

- On Disconnect: set `status = 'disconnected'` on the user’s `whatsapp_connections` row. Do not delete the row or cascade-delete conversations/messages.
- Inbound webhook: no row with `status = 'active'` → do not create new conversation or message for that user (return 200).
- Outbound send: no active connection → return 403 “Connect WhatsApp in Profile”.
- Existing `inbox_conversations` and `inbox_messages` with that `user_id` remain visible read-only (RLS still allows SELECT by `user_id = auth.uid()`).

---

## 9. Deliverables checklist

| Deliverable | Section |
|-------------|---------|
| Exact migration plan | §1 |
| RLS policies | §2 |
| Edge function change list | §3 |
| Frontend component change list | §4 |
| Backfill for owner (`user_id`) | §5 |
| Security notes for credential encryption | §6 |

---

*End of specification.*
