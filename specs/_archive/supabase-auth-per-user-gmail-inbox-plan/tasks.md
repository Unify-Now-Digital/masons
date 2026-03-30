# Tasks: Supabase Auth + per-user Gmail Inbox

## Implementation status

- **Phase 0:** [X] Auth UI + route guards
- **Phase 1:** [X] DB migrations (Option A: user_id nullable, no truncate; RLS hides legacy rows)
- **Phase 2:** [X] Edge Functions (gmail-oauth-start, gmail-oauth-callback, gmail-sync-now, gmail-send-reply)
- **Phase 3:** [X] Frontend Gmail panel + Inbox wiring
- **Phase 4:** [ ] QA + config docs (see QA_CHECKLIST.md and quickstart.md)

## Phase order and dependencies

- **Phase 0:** Auth UI + route guards (no DB dependency; can run first so users can log in).
- **Phase 1:** DB migrations (gmail_connections; then inbox tables user_id + gmail_connection_id; RLS). Must complete before Edge Functions that write to these tables.
- **Phase 2:** Edge Functions (gmail-oauth-start, gmail-oauth-callback, gmail-sync-now, gmail-send-reply). Depend on Phase 1 (tables exist).
- **Phase 3:** Frontend Gmail connection UI + Inbox wiring (calls Edge Functions; depends on Phase 2).
- **Phase 4:** QA + config docs.

---

## Phase 0: Supabase Auth UI + route guards

### 0.1 Auth routes and pages

- **Routes to add:** `/login`, `/register`, `/auth/callback` (for Supabase OAuth return). Place outside dashboard or as siblings; `/auth/callback` handles `?code=...` from Supabase after Google login.
- **Files:** e.g. `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`, `src/pages/AuthCallbackPage.tsx` (or under `src/modules/auth/`). Wire in `src/app/router.tsx`.
- **Behavior:** Register uses `signUp(email, password, { emailRedirectTo })`; show "Check your email" after submit. Login uses `signInWithPassword` and `signInWithOAuth({ provider: 'google', options: { redirectTo: `${APP_BASE_URL}/auth/callback` } })`. Callback page: exchange code for session if needed (Supabase client handles this when redirecting to same app), then redirect to `/dashboard`.

### 0.2 Route guard (protected dashboard)

- **Behavior:** Unauthenticated users hitting `/dashboard/*` redirect to `/login`. After login/callback, redirect to `/dashboard` (or previous URL). Use Supabase `onAuthStateChange` or check `supabase.auth.getSession()` in a guard component or router loader.
- **Files:** e.g. wrap dashboard route in a component that checks session and redirects to `/login` if null; or use a loader that returns redirect.

### 0.3 Redirect URL from config

- **Requirement:** Use env for all redirect URLs. e.g. `VITE_APP_URL` or `VITE_APP_BASE_URL`; build `redirectTo` as `${import.meta.env.VITE_APP_URL}/auth/callback`. No hardcoded localhost or staging domain.

---

## Phase 1: Database migrations (exact sequence)

### 1.1 Create gmail_connections table

- **Migration file:** e.g. `supabase/migrations/YYYYMMDDHHMMSS_create_gmail_connections.sql`
- **Steps:**
  - Create table `public.gmail_connections` with columns: id, user_id (references auth.users(id) on delete cascade), provider (default 'google'), email_address, access_token, refresh_token, token_expires_at, scope, status (default 'active', check in ('active','revoked','error')), created_at, updated_at.
  - Create partial unique index: `CREATE UNIQUE INDEX idx_gmail_connections_one_active_per_user ON public.gmail_connections (user_id) WHERE status = 'active';`
  - Enable RLS. Policies: SELECT, INSERT, UPDATE, DELETE for `user_id = (select auth.uid())` only. No anon access.

### 1.2 Inbox tables: clear existing data and add user_id / gmail_connection_id

- **Migration (Option A — no backfill):**
  - Truncate `inbox_messages` (or delete all rows); then truncate `inbox_conversations` (or delete all rows). Order: messages first (if FK from messages to conversations).
  - Alter `inbox_conversations`: add `user_id` uuid NOT NULL. Add FK to auth.users(id) on delete cascade (optional but recommended). Create index on user_id.
  - Alter `inbox_messages`: add `user_id` uuid NOT NULL; add `gmail_connection_id` uuid NULL references gmail_connections(id) on delete set null. Create indexes on user_id and gmail_connection_id.
- **Note:** If truncate is not acceptable, alternative: add user_id as nullable, backfill to a single system user, then add RLS and require user_id in app; spec chose Option A (no backfill), so truncate/delete is the intended approach.

### 1.3 RLS on inbox tables

- **Enable RLS** on inbox_conversations and inbox_messages if not already.
- **Policies:** SELECT where `user_id = (select auth.uid())`. INSERT/UPDATE: allow only for authenticated with user_id = auth.uid() for client-initiated inserts if any; for Edge Functions (service role), no policy needed (bypass RLS). Alternatively: allow INSERT/UPDATE only via service role and enforce in code that user_id is set from JWT.

---

## Phase 2: Edge Functions

### 2.1 gmail-oauth-start

- **Create/update:** `supabase/functions/gmail-oauth-start/index.ts` (or reuse existing gmail-oauth with new contract).
- **Auth:** Require JWT; reject 401 if missing/invalid.
- **Input:** None (GET or POST). Reads user from JWT.
- **Output:** 200 `{ "url": "<google_oauth_url>" }`. URL built with GMAIL_OAUTH_REDIRECT_URL from secrets; state contains user_id + nonce; scopes = Gmail read + send.
- **Config:** GMAIL_OAUTH_REDIRECT_URL required; fail with clear error if not set. Do not hardcode redirect host.

### 2.2 gmail-oauth-callback

- **Create/update:** `supabase/functions/gmail-oauth-callback/index.ts`.
- **Auth:** No JWT; validate state (user_id + nonce).
- **Input:** GET with query code, state. Exchange code for tokens; fetch Gmail profile (email). Mark existing active connection for user as revoked; insert new row in gmail_connections (status active, refresh_token, email_address, user_id). Redirect to FRONTEND_POST_AUTH_REDIRECT_URL or APP_BASE_URL with ?gmail=connected. Never return tokens.

### 2.3 gmail-sync-now

- **Create/update:** `supabase/functions/gmail-sync-now/index.ts` (or adapt inbox-gmail-sync to be JWT + per-user).
- **Auth:** JWT required. Resolve user_id from JWT. Load active gmail_connection for user (service role). If none, 404.
- **Input:** POST; optional body `{ "since": "<ISO>" }`. Sync "from now onward" using last_synced_at or after: filter. Write to inbox_conversations and inbox_messages with user_id and gmail_connection_id.
- **Output:** 200 `{ "ok": true, "synced": n }`. Never return tokens.

### 2.4 gmail-send-reply

- **Create/update:** `supabase/functions/gmail-send-reply/index.ts` (or adapt inbox-gmail-send to be JWT + per-user).
- **Auth:** JWT required. Resolve user_id; load active gmail_connection.
- **Input:** POST body `{ "conversation_id": "uuid", "message_body": "string", "subject": "string" (optional) }`. Send via Gmail API; insert outbound message into inbox_messages with user_id and gmail_connection_id.
- **Output:** 200 `{ "ok": true, "message_id": "uuid" }`. Never return tokens.

---

## Phase 3: Frontend — Gmail connection UX + Inbox wiring

### 3.1 Gmail connection panel

- **Location:** Unified Inbox settings area or global settings. Component e.g. `GmailConnectionPanel.tsx`.
- **Behavior:** If no active gmail_connection (query via Supabase client; RLS returns only own row): show "Connect Gmail" button. Button calls Edge Function gmail-oauth-start (with JWT), gets URL, redirects window to URL. If active: show connected email_address; buttons "Replace Gmail" (same as Connect) and "Disconnect" (call Edge Function or update status to revoked and clear tokens server-side).
- **Replace flow:** Same as Connect; callback marks previous active as revoked and inserts new row.

### 3.2 Inbox polling and send

- **Polling:** Replace or add polling that calls gmail-sync-now with JWT (e.g. same interval as before). Remove reliance on global INBOX_ADMIN_TOKEN for Gmail sync when user is authenticated.
- **Send reply:** Route email replies through gmail-send-reply Edge Function (JWT in header). Inbox UI already has send; swap backend from inbox-gmail-send (admin token) to gmail-send-reply (JWT).
- **No Gmail connected:** Inbox still shows other channels (e.g. SMS) if any; show prompt to connect Gmail for email channel. Do not break scroll guards or realtime invalidation.

### 3.3 Redirect URL config

- **Frontend:** Use `import.meta.env.VITE_APP_URL` (or VITE_APP_BASE_URL) for all redirect URLs (Supabase Auth redirectTo, and any link to Gmail callback). Document in quickstart that this must be set for staging (e.g. Cloudflare Pages URL).

---

## Phase 4: QA and documentation

### 4.1 Testing checklist

- [ ] **Auth:** Register with email/password → receive confirmation → confirm → can access dashboard. Login with email/password works. Login with Google (minimal scopes) → lands on dashboard. Logout works. Unauthenticated user redirected to /login.
- [ ] **RLS isolation:** Create two users; connect Gmail for user A; verify user B cannot see user A's conversations/messages or gmail_connections row.
- [ ] **Connect Gmail:** Click Connect Gmail → redirect to Google → consent → redirect back → connected email shown. Sync runs (gmail-sync-now) and new messages appear from now onward.
- [ ] **Replace Gmail:** Connect second account → previous connection revoked; new email shown; sync uses new account.
- [ ] **Send reply:** Send email reply from Inbox → succeeds; message appears as outbound with user_id and gmail_connection_id.
- [ ] **Inbox stability:** No scroll jump when switching conversations; realtime still invalidates only (no manual cache patch); scroll guards unchanged.
- [ ] **Tokens:** Verify refresh_token and access_token never appear in client (network tab, response bodies).

### 4.2 Config checklist (deliverable)

- **Supabase secrets:** GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REDIRECT_URL (required), FRONTEND_POST_AUTH_REDIRECT_URL (optional).
- **Frontend env:** VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL (or VITE_APP_BASE_URL) for redirect URL construction.
- **Where redirect URLs are set:** Supabase Dashboard → Auth URL config (Site URL, Redirect URLs for OAuth). Google Cloud Console → OAuth client → Authorized redirect URIs = value of GMAIL_OAUTH_REDIRECT_URL. Document in README or quickstart; no hardcoded localhost/staging domain.

---

## Summary: deliverables

1. **Step-by-step phases:** 0 (Auth UI + guards) → 1 (DB migrations) → 2 (Edge Functions) → 3 (Frontend Gmail + Inbox) → 4 (QA + docs). Order: DB before Edge Functions that write; Edge Functions before frontend that call them.
2. **Exact migrations:** (1) create gmail_connections + RLS; (2) truncate inbox_messages then inbox_conversations; add user_id to both; add gmail_connection_id to inbox_messages; RLS on inbox tables.
3. **Edge Functions:** gmail-oauth-start, gmail-oauth-callback, gmail-sync-now, gmail-send-reply; all JWT where applicable; inputs/outputs per contracts; redirect URL from config.
4. **Frontend:** Auth routes (login, register, auth/callback); route guard; Gmail connection panel (Connect/Replace/Disconnect); Inbox polling via gmail-sync-now; send via gmail-send-reply; VITE_APP_URL for redirects.
5. **Testing checklist:** Auth flows, RLS isolation, connect/replace, sync, send reply, inbox stability, no token leak.
6. **Config checklist:** Supabase secrets and frontend env; where redirect URLs are configured; no hardcoded domains.
