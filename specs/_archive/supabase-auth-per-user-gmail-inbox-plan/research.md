# Research: Supabase Auth + Per-User Gmail Inbox

## Source of truth

- **Spec:** `specs/supabase-auth-per-user-gmail-inbox.md`

## Hard constraints (must follow)

- Do **not** change locked core: Invoices → Orders → Jobs → Installations.
- Preserve Unified Inbox stability: realtime **invalidation-only**; no manual cache patching; scroll guards unchanged.
- **Separate flows:** Google OAuth login = minimal scopes (openid, email, profile). "Connect Gmail" = separate consent flow for Gmail scopes.
- **One active Gmail connection per user.** Connecting again = replace (revoke/clear previous).
- **Sync policy:** "From now onward" only (no historical backfill).
- **Migration strategy Option A:** No backfill. After Auth+RLS, inbox is empty for a user until they connect Gmail; new sync creates all rows with `user_id = auth.uid()`.
- **Tokens (refresh/access) never exposed to the client.**

## Current state (codebase)

- **Auth:** No login/register in app; dashboard routes are open. Some Edge Functions use `INBOX_ADMIN_TOKEN` or internal key.
- **gmail_accounts:** Exists (migration 20250729); has `user_id`, `refresh_token`, etc. Spec introduces **gmail_connections** as the new table (status, provider, one-active-per-user constraint).
- **inbox_conversations / inbox_messages:** Exist; altered in later migrations (external_message_id, person_id, etc.). Currently **no user_id**; no RLS by user.
- **inbox-gmail-sync:** Uses global env: `GMAIL_CLIENT_ID`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL`, `INBOX_ADMIN_TOKEN`. Single-tenant sync.
- **inbox-gmail-send:** Similar; sends via single Gmail account.
- **gmail-oauth, gmail-sync:** Present in functions/; may be legacy; plan uses new names: gmail-oauth-start, gmail-oauth-callback, gmail-sync-now, gmail-send-reply (or update existing).

## Redirect URL (planning note)

- Staging redirect URL is **unknown**. Implement via **configuration only**:
  - e.g. `APP_BASE_URL` or `VITE_APP_URL` (or `GMAIL_OAUTH_REDIRECT_URL` in Supabase secrets built from frontend base URL + path).
  - **Do not hardcode** localhost or a specific staging domain.
  - Document: "Set GMAIL_OAUTH_REDIRECT_URL = {APP_BASE_URL}/gmail/callback" (or equivalent path).

## Technical decisions from spec

- Supabase Auth for all auth (email/password + Google).
- Email confirmation required before access.
- Gmail connection = separate OAuth flow; store refresh_token in `gmail_connections`; Edge Functions use service role and set `user_id` on all writes.
- RLS: SELECT/INSERT/UPDATE/DELETE on gmail_connections and inbox tables by `user_id = auth.uid()`; sync/send functions use service role and pass `user_id` from JWT.
