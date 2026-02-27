# Edge Function: gmail-oauth-callback

## Purpose

Handles redirect from Google OAuth: exchange code for tokens, store in `gmail_connections`, redirect user back to app.

## Auth

- **No JWT in request.** Callback is a GET with `?code=...&state=...`. State must contain user_id (and nonce) and be validated.

## Request

- **Method:** GET.
- **Query:** `code`, `state` (from Google redirect).

## Response

- **302 Redirect** to frontend URL (e.g. `FRONTEND_POST_AUTH_REDIRECT_URL` or `APP_BASE_URL/dashboard/inbox?gmail=connected`) with success.
- **400/500:** Redirect to same URL with `?error=...` or show error page.

## Config (Supabase secrets)

- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.
- `GMAIL_OAUTH_REDIRECT_URL` (must match Google Cloud Console redirect URI).
- `FRONTEND_POST_AUTH_REDIRECT_URL` or derive from env (e.g. app base URL + path).

## Behavior

- Exchange code for access_token + refresh_token.
- Fetch Gmail user profile (email_address).
- **Replace logic:** Mark any existing row in gmail_connections for this user_id with status = 'active' to status = 'revoked'. Insert new row with status = 'active', refresh_token, email_address, user_id. Never return tokens to client.
- Redirect to frontend with success (or error) query param.
