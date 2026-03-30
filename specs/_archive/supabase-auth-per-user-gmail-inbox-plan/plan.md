# Implementation Plan: Supabase Auth + per-user Gmail Inbox

## Source of truth

- **Spec:** `specs/supabase-auth-per-user-gmail-inbox.md`
- **Hard constraints:** No change to Invoices → Orders → Jobs → Installations. Unified Inbox: realtime invalidation-only, no cache patching, scroll guards unchanged. Google login = minimal scopes; Connect Gmail = separate OAuth. One active Gmail per user; sync "from now onward"; Option A migration (no backfill). Tokens never to client. Redirect URLs from config only (no hardcoded domain).

---

## 1. Implementation phases (order and dependencies)

| Phase | Name | Depends on | Deliverables |
|-------|------|------------|--------------|
| 0 | Auth UI + route guards | — | Login, Register, Auth callback, route guard, redirect from env |
| 1 | DB migrations | — | gmail_connections table; inbox tables user_id + gmail_connection_id; RLS |
| 2 | Edge Functions | Phase 1 | gmail-oauth-start, gmail-oauth-callback, gmail-sync-now, gmail-send-reply |
| 3 | Frontend Gmail + Inbox | Phase 2 | Gmail connection panel; Inbox polling/send via new functions; VITE_APP_URL |
| 4 | QA + docs | Phase 3 | Testing checklist; config checklist; README/quickstart |

**Critical path:** Phase 1 must complete before Phase 2 (tables must exist). Phase 2 before Phase 3 (frontend calls functions). Phase 0 can run in parallel with Phase 1 (no shared dependency).

---

## 2. Exact database migration steps (sequence to avoid downtime)

1. **Migration A — Create gmail_connections**
   - Create table with columns: id, user_id (FK auth.users), provider, email_address, access_token, refresh_token, token_expires_at, scope, status (check active/revoked/error), created_at, updated_at.
   - Partial unique index on (user_id) where status = 'active'.
   - Enable RLS; policies SELECT/INSERT/UPDATE/DELETE for user_id = auth.uid().

2. **Migration B — Inbox tables (Option A: no backfill)**
   - Truncate inbox_messages; truncate inbox_conversations (order: messages first if FK exists).
   - Alter inbox_conversations: add user_id uuid NOT NULL, FK auth.users(id) on delete cascade; index user_id.
   - Alter inbox_messages: add user_id uuid NOT NULL; add gmail_connection_id uuid NULL references gmail_connections(id); index user_id, gmail_connection_id.
   - Enable RLS on both if not already; policies SELECT (and INSERT/UPDATE if needed) where user_id = auth.uid(). Service role used by Edge Functions bypasses RLS and must set user_id (and gmail_connection_id) on every insert.

---

## 3. Edge Functions: create/update, I/O, auth

| Function | Create/Update | Auth | Input | Output |
|----------|----------------|------|--------|--------|
| gmail-oauth-start | Create or replace existing gmail-oauth | JWT required | GET/POST, no body | 200 { url } |
| gmail-oauth-callback | Create or replace | State (user_id+nonce) | GET ?code=&state= | 302 redirect |
| gmail-sync-now | Create or adapt inbox-gmail-sync | JWT required | POST, optional { since } | 200 { ok, synced } |
| gmail-send-reply | Create or adapt inbox-gmail-send | JWT required | POST { conversation_id, message_body, subject? } | 200 { ok, message_id } |

- All that touch tokens or DB: validate JWT (or state for callback); use service role for DB; never expose refresh_token or access_token to client.
- Redirect URL for OAuth: from Supabase secret GMAIL_OAUTH_REDIRECT_URL; fail clearly if unset. Do not hardcode host.

---

## 4. Frontend routes and component changes

**Auth**
- **Routes:** `/login`, `/register`, `/auth/callback`. Register in router; dashboard routes wrapped by guard.
- **Components/pages:** LoginPage (email/password + Google button with redirectTo from VITE_APP_URL); RegisterPage (email/password + "Check your email"); AuthCallbackPage (handle OAuth code, redirect to /dashboard).
- **Guard:** Protected route wrapper or loader; redirect to /login if no session.

**Gmail connection**
- **Component:** Gmail connection panel (e.g. in Inbox settings or global settings). Fetches active gmail_connection (RLS returns own). Connect → invoke gmail-oauth-start, redirect to URL. Replace = same. Disconnect → revoke/clear (API or function). Show connected email when active.
- **Inbox:** Polling calls gmail-sync-now with JWT. Send reply calls gmail-send-reply with JWT. If no Gmail connected, show prompt for email channel; other channels still work.

**Config**
- Use `VITE_APP_URL` (or `VITE_APP_BASE_URL`) for all redirect URLs (Auth redirectTo, links). Document that staging must set this (e.g. Cloudflare Pages URL).

---

## 5. Testing checklist

- Auth: Register → confirm → login (password + Google) → logout; unauthenticated → /login.
- RLS: Two users; one connects Gmail; other cannot see first’s data.
- Gmail: Connect → sync from now onward; Replace → old revoked, new used; send reply → appears outbound.
- Inbox stability: No scroll jump; realtime invalidation only; scroll guards unchanged.
- Tokens: Not present in any client-visible response.

---

## 6. Config checklist (Supabase secrets + env; redirect URLs)

**Supabase secrets**
- GOOGLE_OAUTH_CLIENT_ID
- GOOGLE_OAUTH_CLIENT_SECRET
- GMAIL_OAUTH_REDIRECT_URL (required; e.g. `{APP_BASE_URL}/gmail/callback`; value from env, not hardcoded)
- FRONTEND_POST_AUTH_REDIRECT_URL (optional)

**Frontend env**
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_APP_URL or VITE_APP_BASE_URL (base URL for redirects; set to staging URL on Cloudflare)

**Where redirect URLs are configured**
- Supabase Dashboard → Authentication → URL Configuration: Site URL, Redirect URLs (e.g. `{VITE_APP_URL}/auth/callback`).
- Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs: must match GMAIL_OAUTH_REDIRECT_URL exactly (e.g. `https://your-app.pages.dev/gmail/callback`). No hardcoded localhost or staging domain in code.

---

## 7. Artifacts

| Artifact | Path |
|----------|------|
| Research | specs/supabase-auth-per-user-gmail-inbox-plan/research.md |
| Data model | specs/supabase-auth-per-user-gmail-inbox-plan/data-model.md |
| Contracts | specs/supabase-auth-per-user-gmail-inbox-plan/contracts/ (edge-function-*.md) |
| Quickstart | specs/supabase-auth-per-user-gmail-inbox-plan/quickstart.md |
| Tasks | specs/supabase-auth-per-user-gmail-inbox-plan/tasks.md |
| Plan | specs/supabase-auth-per-user-gmail-inbox-plan/plan.md (this file) |

---

## Progress tracking

- [ ] Phase 0: Auth UI + route guards
- [ ] Phase 1: DB migrations (gmail_connections; inbox user_id + gmail_connection_id; RLS)
- [ ] Phase 2: Edge Functions (oauth-start, callback, sync-now, send-reply)
- [ ] Phase 3: Frontend Gmail panel + Inbox wiring
- [ ] Phase 4: QA + config docs
