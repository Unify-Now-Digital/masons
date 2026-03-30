# Supabase Auth + Per-User Gmail Connection for Unified Inbox

## Overview

Add Supabase Auth (email/password with confirmation, Google OAuth login) and per-user Gmail integration for the Unified Inbox. Gmail OAuth and token storage become user-scoped; one active Gmail connection per user; sync and send run via Edge Functions using the logged-in user's connection. Inbox data and Gmail tokens are protected by RLS and never exposed to the client.

**Context (locked):**
- Mason app remains invoice-centric: Invoices → Orders → Jobs → Installations (unchanged).
- Unified Inbox patterns are stable: realtime invalidation only, no manual cache patching; scroll guards must remain intact.
- Backend is Supabase only (Postgres, RLS, Edge Functions). No custom Node server.
- Gmail integration becomes per-user (refresh token stored per user); one active connection per user (replace = revoke/clear previous).
- Auth: email/password registration with confirmation; Google OAuth login (minimal scopes: openid, email, profile); separate "Connect Gmail" consent flow (Gmail scopes) after login.
- If user logs in with Google, Gmail is NOT auto-connected; UX should prompt "Connect Gmail" one-click CTA; user may connect a different Gmail account.
- Gmail capability: read + send (reply). Sync: "from now onward" (no full history backfill).
- Secrets in Supabase secrets; redirect URL env-configured and documented (staging URL unknown).

**Goals:**
1. Authentication UX: Register (email/password, confirm), Login (email/password + Google), Logout, session persistence, route guarding.
2. Gmail connection UX: Connect Gmail, Disconnect/Replace, show connected address; replace revokes/clears previous.
3. Per-user Gmail backend: store refresh token server-side; Edge Functions for OAuth start/callback, sync, send; tokens never to client.
4. Unified Inbox uses logged-in user's Gmail; RLS enforces user_id ownership on all inbox data.

---

## Current State Analysis

### Auth and ownership

- **Auth:** No Supabase Auth login/registration in app; possible anon usage or internal key for some Edge Functions.
- **Inbox ownership:** Inbox tables (e.g. `inbox_conversations`, `inbox_messages`) may not have `user_id`; Gmail sync may use a single global/test account.
- **Gmail:** Existing Edge Functions (e.g. `inbox-gmail-sync`, `inbox-gmail-send`) likely use env credentials or a single refresh token; not per-user.

### Inbox tables (reference)

- **inbox_conversations:** Conversations per channel; may have `person_id`, `channel`, `primary_handle`, etc.
- **inbox_messages:** Messages with `conversation_id`, `direction`, `body_text`, etc.; no `user_id` or `gmail_connection_id`.
- **gmail_accounts / similar:** If present, likely single-tenant or global; to be replaced or aligned with `gmail_connections` per user.

### Relationship and data access

- Conversations and messages are fetched by filters (channel, status, person_id, etc.) without user scoping.
- Realtime subscriptions invalidate queries; no user_id filter in channel if RLS does not enforce it.
- Gmail sync/send run via Edge Functions with admin token or anon; not JWT + user-scoped.

**Gaps:**
- No `user_id` on inbox entities; no RLS by user.
- No per-user Gmail token storage; no "Connect Gmail" flow.
- No auth UI or route guards.

---

## Recommended Schema Adjustments

### Database changes

**New table: `gmail_connections`**
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid not null references auth.users(id) on delete cascade
- `provider` text not null default 'google'
- `email_address` text null
- `access_token` text null (short-lived; optional)
- `refresh_token` text not null (server-side only; encrypt if possible)
- `token_expires_at` timestamptz null
- `scope` text null
- `status` text not null default 'active' — 'active' | 'revoked' | 'error'
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()
- Constraint: unique(user_id) where status = 'active' (one active connection per user)

**Inbox table updates (minimal; preserve existing structure):**
- **inbox_conversations:** add `user_id` uuid not null (backfill or restrict to new data only).
- **inbox_messages:** add `user_id` uuid not null; add `gmail_connection_id` uuid null references gmail_connections(id).
- **People/customers (if used by inbox):** align ownership to user_id where applicable.

Target: all inbox rows owned by auth user; RLS enforces `user_id = auth.uid()`.

### RLS policies

- **gmail_connections:** Enable RLS. SELECT/INSERT/UPDATE/DELETE only where `user_id = (select auth.uid())`. No public/anon access.
- **Inbox tables:** Enable RLS where not already. SELECT: `user_id = (select auth.uid())`. INSERT/UPDATE: service role for sync writes, with correct user_id set; or restrict to user_id = auth.uid() where appropriate.
- Edge Functions using service role must always set `user_id` (and `gmail_connection_id` for messages) when writing.

---

## Implementation Approach

### Phase 1: Supabase Auth UI + route guards

- Add routes: `/login`, `/register`, `/auth/callback` (for Supabase OAuth return if needed).
- Auth components/pages: Register (email/password, emailRedirectTo); Login (password + Google OAuth); post-signUp "Check your email"; handle confirmation UX.
- Use Supabase JS: signUp, signInWithPassword, signInWithOAuth({ provider: 'google', options: { redirectTo } }), signOut.
- Route guard: unauthenticated → redirect to /login; after login → /dashboard.
- Email confirmation required before access (Supabase + UX).

### Phase 2: gmail_connections table + migrations

- Create migration for `gmail_connections` with columns and unique partial index on (user_id) where status = 'active'.
- Enable RLS; policies for authenticated user only, by user_id.

### Phase 3: user_id + gmail_connection_id on inbox tables + RLS

- Migrations: add `user_id` to inbox_conversations, inbox_messages; add `gmail_connection_id` to inbox_messages; FKs and indexes as needed.
- Backfill strategy: Option A delete test data; Option B backfill to a specific admin user_id (service role). Prefer minimal-risk.
- RLS: SELECT by user_id = auth.uid(); INSERT/UPDATE for sync via service role with user_id set.

### Phase 4: Edge Functions — Gmail OAuth and sync/send

- **gmail-oauth-start:** Requires JWT. Builds OAuth URL with Gmail scopes, state = user_id + nonce. Redirect URI from secret GMAIL_OAUTH_REDIRECT_URL. Returns URL for client redirect.
- **gmail-oauth-callback:** Exchanges code for tokens (GOOGLE_OAUTH_CLIENT_ID/SECRET). Upserts gmail_connections for user: one active; mark previous active as revoked. Store refresh_token, email_address (from Gmail profile). Never return tokens to client.
- **gmail-sync-now:** Authenticated. Uses user's active gmail_connections; sync "from now onward" (last_synced_at or after: filter). Writes inbox_messages with user_id and gmail_connection_id.
- **gmail-send-reply:** Input { conversation_id, message_body, subject? }. Uses user's Gmail; sends via Gmail API; writes sent message to inbox_messages as outbound with user_id and gmail_connection_id.

All functions validate JWT; use service role for DB; never expose refresh_token.

### Phase 5: Frontend — Gmail connection UX + Inbox wiring

- Gmail connection panel (Unified Inbox settings or global): Connect Gmail (calls gmail-oauth-start, redirect to URL); show connected email; Replace / Disconnect (revoke, clear tokens).
- After Google login, show one-click CTA to Connect Gmail (optional).
- Inbox: Polling calls gmail-sync-now with JWT (per-user). Send replies via gmail-send-reply. If no Gmail connected, allow viewing other channels; prompt to connect for email.
- Remove or reduce reliance on INTERNAL_FUNCTION_KEY for AI once JWT is primary; keep fallback if scope risk.

### Phase 6: QA and documentation

- Test: register + confirm, login (password + Google), connect/replace Gmail, sync new messages, send reply; verify RLS isolation (second user cannot see first user's data).
- README/setup: Google Cloud Console OAuth + Supabase redirect (GMAIL_OAUTH_REDIRECT_URL); env checklist.

### Safety considerations

- Realtime: keep invalidation-only; ensure RLS and filters so user sees only own data.
- Scroll guards and Unified Inbox layout unchanged.
- Migrations additive where possible; backfill or truncate test data as chosen.
- Redirect URL required in env; fail with clear error if missing.

---

## What NOT to Do

- No roles/RBAC in this task.
- No multi-org / multi-tenant.
- No production/staging env split required.
- No historical Gmail backfill beyond "from now onward."
- Do not change invoice-centric app structure (Invoices → Orders → Jobs).
- Do not introduce manual cache patching or change realtime to anything other than invalidation.
- Do not expose Gmail refresh (or access) tokens to the client.

---

## Environment and configuration

**Supabase secrets:**
- GOOGLE_OAUTH_CLIENT_ID
- GOOGLE_OAUTH_CLIENT_SECRET
- GMAIL_OAUTH_REDIRECT_URL (e.g. https://&lt;staging-domain&gt;/gmail/callback or similar; document exact path)
- FRONTEND_POST_AUTH_REDIRECT_URL (optional)

**Frontend env:**
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Redirect URL must be set; fail gracefully with clear error if not configured.

---

## Acceptance Criteria

- User can register (email/password) and must confirm email before accessing dashboard.
- User can log in with Google (openid/email/profile) and land on dashboard.
- Authenticated user can connect Gmail via separate consent flow.
- After connecting Gmail, Unified Inbox shows connected address and syncs new messages from that point onward.
- User can replace Gmail connection; old connection revoked and new one used.
- User can send email replies from Mason via Gmail.
- Gmail tokens never exposed client-side.
- RLS prevents one user from seeing another user's inbox or Gmail connection.
- Unified Inbox stability preserved (no scroll jump regressions, no cache patching, realtime invalidation only).

---

## Task Breakdown (for /plan)

1. Add Supabase Auth UI + route guards.
2. Create gmail_connections table + migrations.
3. Add user_id + gmail_connection_id to inbox tables and RLS policies.
4. Implement Edge Functions: gmail-oauth-start, gmail-oauth-callback, gmail-sync-now, gmail-send-reply.
5. Update frontend Inbox to use per-user Gmail (polling, send, connection panel).
6. QA: register/login, connect/replace Gmail, send reply, RLS isolation; document redirect and OAuth setup.

---

## Open Questions / Considerations

- Staging redirect URL exact value (Cloudflare Pages); implement with env and document what to set.
- Optional: encrypt refresh_token at rest (DB or app layer); minimum is server-side only + strict RLS.
- AI Edge Function: switch to JWT-only when auth is live vs. keep internal key fallback for safety.
