# QA Checklist: Supabase Auth + per-user Gmail Inbox

Use this after implementing the spec to validate behaviour.

## Auth

- [ ] **Register** — New user can register with email/password; confirmation email received (if enabled).
- [ ] **Confirm email** — Clicking confirm link lands on `/auth/callback` and redirects to `/dashboard`.
- [ ] **Login (password)** — User can sign in with email/password and is redirected to `/dashboard`.
- [ ] **Login (Google)** — User can sign in with Google (minimal scopes: openid, email, profile); redirects to `/auth/callback` then `/dashboard`.
- [ ] **Logout** — Sign out clears session and redirects to `/login`.
- [ ] **Protected routes** — Unauthenticated access to `/dashboard` (or any nested route) redirects to `/login`.

## RLS isolation

- [ ] **Two users** — Create two test users (e.g. User A and User B).
- [ ] **User A connects Gmail** — User A completes "Connect Gmail"; sync runs; conversations/messages appear for User A.
- [ ] **User B cannot see A’s data** — As User B, inbox shows only B’s conversations (or empty); no visibility of A’s email or Gmail connection.

## Gmail connect / replace / disconnect

- [ ] **Connect Gmail** — Click "Connect Gmail"; redirects to Google; after consent, redirects back to app with "Gmail connected" (or similar); panel shows connected email.
- [ ] **Replace** — With one Gmail connected, click "Replace" and connect a different Google account; previous connection is revoked; new connection is active; sync uses new account.
- [ ] **Disconnect** — Click "Disconnect"; panel shows "No Gmail account connected"; sync no longer runs for that user.

## Sync baseline (“from now onward”)

- [ ] **First connect** — On first connect, `last_synced_at` is set to now(); no historical backfill.
- [ ] **Sync after connect** — New mail arriving after connect appears in inbox after sync (manual or 60s poll).
- [ ] **No token leak** — No access_token or refresh_token in any client-visible response (check network tab and UI).

## Send reply

- [ ] **Send reply** — In an email conversation, send a reply; message appears in thread and in Gmail; record has `user_id` and `gmail_connection_id`.
- [ ] **No Gmail connected** — With no Gmail connected, attempting to send an email reply shows a clear error (no crash).

## Inbox stability

- [ ] **Realtime** — Inbox uses invalidation-only (no cache patching); new/changed rows refetched via query invalidation.
- [ ] **Scroll guards** — Scroll position / scroll guards unchanged from prior behaviour.
- [ ] **Grid layout** — No conditional duplicated grid columns; layout consistent.

## Config

- [ ] **Redirect URLs** — Supabase Dashboard → Auth URL config includes `{VITE_APP_URL}/auth/callback`.
- [ ] **Google Console** — Authorized redirect URI for Gmail OAuth equals `GMAIL_OAUTH_REDIRECT_URL` (Edge Function callback URL).
- [ ] **Secrets** — `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REDIRECT_URL`, and optionally `FRONTEND_POST_AUTH_REDIRECT_URL` set in Supabase.
- [ ] **Frontend env** — `VITE_APP_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_FUNCTIONS_URL` set for the deployed app.
