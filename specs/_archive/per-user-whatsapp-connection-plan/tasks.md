# Tasks: Per-user WhatsApp connection

Reference: [per-user-whatsapp-connection.md](../per-user-whatsapp-connection.md), [implementation plan](../per-user-whatsapp-connection-implementation-plan.md).

---

## Phase 1 – Database and RLS

### Task 1.1: Migration – create whatsapp_connections [X]

**File:** `supabase/migrations/YYYYMMDDHHmmss_create_whatsapp_connections.sql`

- Create table `public.whatsapp_connections` with columns: id, company_id, user_id, provider, twilio_account_sid, twilio_api_key_sid, twilio_api_key_secret_encrypted, whatsapp_from, status, last_error, last_validated_at, disconnected_at, created_at, updated_at.
- Add check on status: 'active', 'disconnected', 'error', 'pending_validation'.
- Create unique partial index on (user_id) where status = 'active'.
- Create index on (user_id); create index on (twilio_account_sid, whatsapp_from) where status = 'active'.
- Enable RLS. Create policies: select, insert, update, delete for authenticated with user_id = auth.uid().
- If `public.companies` exists, add FK on company_id; else add comment only.

**Verify before:** Grep migrations for `create table.*companies`.

---

### Task 1.2: Migration – add whatsapp_connection_id to inbox_messages [X]

**File:** `supabase/migrations/YYYYMMDDHHmmss_add_whatsapp_connection_id_to_inbox_messages.sql`

- Alter table inbox_messages add column whatsapp_connection_id uuid references public.whatsapp_connections(id) on delete set null.
- Create index idx_inbox_messages_whatsapp_connection_id on public.inbox_messages (whatsapp_connection_id).

---

### Task 1.3: RLS – confirm inbox policies [X]

**No new policies.** Confirm existing policies on inbox_conversations and inbox_messages restrict select (and update) by user_id = auth.uid(). Client must not be able to insert with arbitrary user_id; Edge Functions use service role. Document in implementation notes if insert policy is ever added (must set user_id from auth.uid()).

---

## Phase 2 – Credential storage and encryption

### Task 2.1: Edge Function – whatsapp-connect [X]

**File:** `supabase/functions/whatsapp-connect/index.ts` (new)

- Accept POST with JWT; parse body: twilio_account_sid, twilio_api_key_sid, twilio_api_key_secret, whatsapp_from.
- Validate format; call Twilio (e.g. balance or test) to validate credentials.
- Encrypt twilio_api_key_secret (app-level or Vault); store in twilio_api_key_secret_encrypted.
- Insert or update whatsapp_connections for auth.uid(): if existing active row, set it to disconnected then insert new, or update in place; ensure one active per user.
- Set status = 'active' on success; on validation failure set status = 'error', last_error, return 4xx/5xx.
- Never log or store plaintext secret.

**Verify before:** Choose encryption approach (env key + AEAD); add WHATSAPP_SECRET_ENCRYPTION_KEY to Supabase secrets.

---

## Phase 3 – Inbound webhook

### Task 3.1: Update twilio-sms-webhook – route by connection [X]

**File:** `supabase/functions/twilio-sms-webhook/index.ts`

- After parsing AccountSid, To, From, Body: normalize To to same format as whatsapp_from (e.g. E.164).
- Query whatsapp_connections where twilio_account_sid = AccountSid and whatsapp_from = normalized To and status = 'active'. Limit 1.
- If no row: return 200 empty TwiML; do not create conversation or message.
- If row: set ownerUserId = row.user_id, connectionId = row.id.
- In find-or-create conversation: include user_id = ownerUserId. In insert message: include user_id = ownerUserId, whatsapp_connection_id = connectionId (if column exists).
- When creating new conversation, set user_id. When updating existing conversation that had user_id null, optionally update to ownerUserId (or leave as-is and only set on message). Prefer setting both conversation and message user_id for new flow.
- Keep attemptAutoLink unchanged (already uses customers.id).

**Verify before:** Normalization helper: same output for "whatsapp:+44..." and "+44..." if that is the storage convention.

---

## Phase 4 – Outbound send

### Task 4.1: Update inbox-twilio-send – per-user credentials [X]

**File:** `supabase/functions/inbox-twilio-send/index.ts`

- Require Authorization: Bearer &lt;JWT&gt;. Resolve auth.uid() from JWT (createClient with anon key and set session, or verify JWT and get sub).
- Load conversation with .select('id, channel, primary_handle, user_id'). Single(). Enforce conversation.user_id = auth.uid(); if not, return 403.
- Load whatsapp_connections where user_id = auth.uid() and status = 'active', limit 1. If none, return 403 with message to connect WhatsApp in Profile.
- Decrypt twilio_api_key_secret_encrypted (same key as in whatsapp-connect).
- Use Twilio API with Account SID, API Key SID, decrypted secret (not main auth token). From = connection.whatsapp_from (format as whatsapp:+... for WhatsApp); To = conversation.primary_handle (whatsapp:+...).
- On success: insert outbound inbox_message with user_id = auth.uid(), whatsapp_connection_id = connection.id. Update conversation last_message_*, updated_at.
- Remove or keep x-admin-token as fallback for legacy; document.

**Verify before:** How frontend calls send (headers); ensure JWT is sent. If currently only x-admin-token, add JWT to client and optionally keep admin token for transition.

---

## Phase 5 – Frontend

### Task 5.1: Hooks – useWhatsAppConnection, Connect, Disconnect, Test [X]

**Files:** e.g. `src/modules/inbox/hooks/useWhatsAppConnection.ts`, `useWhatsAppConnect.ts`, `useWhatsAppDisconnect.ts`, `useWhatsAppTest.ts`

- useWhatsAppConnection: fetch from whatsapp_connections (filter by current user via RLS); return { data, isLoading, isError }.
- useWhatsAppConnect: mutation; POST to whatsapp-connect with form data (SID, Key SID, Secret, From); secret only in body, never stored in client state.
- useWhatsAppDisconnect: mutation; update whatsapp_connections set status = 'disconnected', disconnected_at = now() for current user's connection (or call Edge Function).
- useWhatsAppTest: mutation; POST to whatsapp-test with JWT; show toast success/failure.

**Verify before:** Gmail hooks path and pattern in `src/modules/inbox/hooks/`.

---

### Task 5.2: Components – WhatsApp connection UI [X]

**Files:** e.g. `src/modules/inbox/components/WhatsAppConnectionPanel.tsx`, `WhatsAppConnectionStatus.tsx`

- Mirror GmailConnectionPanel / GmailConnectionStatus: card with status (not connected, pending_validation, active, error); when active show whatsapp_from (masked if desired); buttons Connect, Replace, Disconnect, Test.
- Connect: open form (Account SID, API Key SID, API Key Secret, WhatsApp From); submit via useWhatsAppConnect. Replace: same form, then disconnect current and connect new (or single “replace” API).
- Do not send or store API Key Secret in client beyond submit to Edge Function.

**Verify before:** GmailConnectionPanel.tsx and GmailConnectionStatus.tsx structure.

---

### Task 5.3: Layout – show WhatsApp status [X]

**File:** `src/app/layout/DashboardLayout.tsx`

- Add WhatsApp connection status next to Gmail (e.g. WhatsAppConnectionStatus or combined “Connections” block). Ensure JWT is available when calling inbox-twilio-send from inbox (e.g. use supabase auth session).

---

### Task 5.4: Inbox send – use JWT [X]

**File(s):** Wherever send message is triggered (e.g. UnifiedInboxPage or conversation view)

- When calling inbox-twilio-send, send Authorization: Bearer &lt;session.access_token&gt; (or equivalent). Remove or keep x-admin-token per rollout plan.

---

## Phase 6 – Test and disconnect

### Task 6.1: Edge Function – whatsapp-test (optional) [X]

**File:** `supabase/functions/whatsapp-test/index.ts`

- POST, JWT required. Load user's active connection; decrypt secret; send test message (e.g. to fixed number or body.to); update last_validated_at. Return 200 or error.

---

### Task 6.2: Disconnect behavior [X]

- Implemented by Task 5.1 (update status + disconnected_at). Inbound: Task 3.1 already returns 200 when no active connection. Outbound: Task 4.1 returns 403 when no active connection. History: RLS allows select by user_id; no delete of conversations/messages.

---

## Phase 7 – Validation, errors, rollout

### Task 7.1: Validation and errors [X]

- Connect: validate SID/Key/From format; Twilio validation before store; set last_error and status = 'error' on failure (Task 2.1).
- Inbound: no match → 200 (Task 3.1).
- Outbound: 400/401/403/404/502 with clear messages (Task 4.1).
- Frontend: toasts or inline errors from API responses; disable buttons while loading (Tasks 5.1–5.2).

### Task 7.2: Rollout and backfill [X]

- Deploy migrations first; then Edge Functions; then frontend. Sandbox first; production same code.
- Backfill (optional): if product wants legacy NULL user_id conversations visible to one user, add migration or script to set user_id for those rows; document.

---

## Summary table

| # | Task | Type | File(s) |
|---|------|------|--------|
| 1.1 | Create whatsapp_connections migration | Migration | supabase/migrations/*_create_whatsapp_connections.sql |
| 1.2 | Add whatsapp_connection_id to inbox_messages | Migration | supabase/migrations/*_add_whatsapp_connection_id_to_inbox_messages.sql |
| 1.3 | Confirm inbox RLS | RLS | — |
| 2.1 | whatsapp-connect Edge Function | Edge Function | supabase/functions/whatsapp-connect/index.ts |
| 3.1 | twilio-sms-webhook route by connection | Edge Function | supabase/functions/twilio-sms-webhook/index.ts |
| 4.1 | inbox-twilio-send per-user credentials | Edge Function | supabase/functions/inbox-twilio-send/index.ts |
| 5.1 | WhatsApp hooks | Frontend | src/modules/inbox/hooks/useWhatsApp*.ts |
| 5.2 | WhatsApp connection components | Frontend | src/modules/inbox/components/WhatsAppConnection*.tsx |
| 5.3 | Layout – WhatsApp status | Frontend | src/app/layout/DashboardLayout.tsx |
| 5.4 | Inbox send with JWT | Frontend | Inbox send call site |
| 6.1 | whatsapp-test Edge Function (optional) | Edge Function | supabase/functions/whatsapp-test/index.ts |
| 6.2 | Disconnect behavior | — | Covered by 3.1, 4.1, 5.1 |
| 7.1 | Validation and errors | — | Across tasks |
| 7.2 | Rollout and backfill | Docs / ops | quickstart, migration |
