# Edge Function: gmail-oauth-start

## Purpose

Returns a Google OAuth URL for the "Connect Gmail" flow. Client redirects the user to this URL.

## Auth

- **JWT required.** Verify Supabase Auth (Authorization: Bearer &lt;token&gt;). Return 401 if missing/invalid.

## Request

- **Method:** GET or POST (either; no body required).
- **Headers:** `Authorization: Bearer <supabase_jwt>`.

## Response

- **200:** `{ "url": "<full_google_oauth_url>" }`. URL includes state (user_id + nonce), Gmail scopes, redirect_uri from `GMAIL_OAUTH_REDIRECT_URL`.
- **401:** `{ "error": "Unauthorized" }`.
- **500:** `{ "error": "..." }` if redirect URL or client id not configured (fail gracefully with clear message).

## Config (Supabase secrets)

- `GOOGLE_OAUTH_CLIENT_ID` (or GMAIL_OAUTH_CLIENT_ID).
- `GMAIL_OAUTH_REDIRECT_URL` — required; e.g. `{APP_BASE_URL}/gmail/callback`. Do not hardcode domain.

## Behavior

- Build state = signed or hashed (user_id + nonce) so callback can verify.
- Scopes: Gmail read + send (e.g. https://www.googleapis.com/auth/gmail.readonly, https://www.googleapis.com/auth/gmail.send, gmail.modify as needed).
- Never return refresh_token or access_token to client.
