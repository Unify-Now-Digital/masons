# Quickstart: Auth + per-user Gmail setup

## Config checklist

### Frontend env (e.g. `.env` / Cloudflare Pages env)

- `VITE_SUPABASE_URL` — Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key.
- `VITE_APP_URL` or `VITE_APP_BASE_URL` — **Base URL of the app** (e.g. `https://your-staging.pages.dev` or `http://localhost:5173`). Used to build redirect URLs; **do not hardcode** a specific domain.

### Supabase secrets (Edge Functions)

- `GOOGLE_OAUTH_CLIENT_ID` — Google OAuth client ID (same can be used for Supabase Auth Google provider and Gmail OAuth).
- `GOOGLE_OAUTH_CLIENT_SECRET` — Google OAuth client secret.
- `GMAIL_OAUTH_REDIRECT_URL` — **Must be configured.** For this implementation the callback is the **Edge Function** `gmail-oauth-callback`, so set this to the full function URL, e.g. `https://<PROJECT_REF>.supabase.co/functions/v1/gmail-oauth-callback`. This exact value must be added to Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs.
- `FRONTEND_POST_AUTH_REDIRECT_URL` (optional) — Where to send the user after Gmail connect success (e.g. `https://your-app.com/dashboard/inbox`). If unset, callback uses a path-based fallback.

### Redirect URLs (where configured)

- **Supabase Auth (Google login):** Configured in Supabase Dashboard → Authentication → URL Configuration (Site URL, Redirect URLs). Add e.g. `{VITE_APP_URL}/auth/callback` for OAuth return.
- **Gmail OAuth (Connect Gmail):** In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs, add the **exact** value of `GMAIL_OAUTH_REDIRECT_URL` (the Supabase Edge Function URL, e.g. `https://<PROJECT_REF>.supabase.co/functions/v1/gmail-oauth-callback`).
- **No hardcoding:** All redirect URLs must come from env (e.g. `VITE_APP_URL` + path). Staging domain is unknown at build time.

## Google Cloud Console OAuth setup (checklist)

1. Create or select a project.
2. Enable Gmail API (and any other needed APIs).
3. Create OAuth 2.0 Client ID (Web application).
4. Add Authorized redirect URIs: **exactly** the value you will set for `GMAIL_OAUTH_REDIRECT_URL` (e.g. `https://<staging>/gmail/callback`).
5. Use the same or a separate client for Supabase Auth Google login (minimal scopes: openid, email, profile). For "Connect Gmail," use a flow that requests Gmail scopes and redirects to the same or a different redirect URI as configured above.

## Supabase Auth

- Enable Email and Google provider in Supabase Dashboard.
- For Google: add Client ID and Client Secret in Supabase; redirect URL in Supabase must match Google Console (e.g. Supabase’s default or your custom callback path).
- Enable "Confirm email" for email signup if required.

## After deploy

1. Set `VITE_APP_URL` (or equivalent) to the deployed app URL (e.g. Cloudflare Pages URL).
2. Set `GMAIL_OAUTH_REDIRECT_URL` in Supabase secrets to the chosen callback URL (app path or Edge Function URL).
3. Ensure Google Console redirect URIs match.
4. Test: Register → confirm email → Login → Connect Gmail → sync and send reply.
