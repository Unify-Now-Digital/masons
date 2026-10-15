# Revolut Business setup

Not deployed. Do not apply the migration or deploy functions until Arin approves. Sandbox first.

## Checklist

- [ ] Revolut Business plan with API access. The connecting user needs API & Integrations: Manage Integrations and Manage API, and Billing: View Business.
- [ ] Certificate. Generate the key pair locally. Upload only the public certificate in Revolut Business → APIs → Business API (include the BEGIN and END lines). Scope READ. Do not request WRITE.
- [ ] Redirect URI. Set the OAuth redirect in Revolut to the project's `revolut-oauth-callback` functions URL. It must be the same value as `REVOLUT_OAUTH_REDIRECT_URL`. The JWT `iss` is that URI's host, with no scheme.
- [ ] Webhook. URL is the project's `revolut-webhook` functions URL (`REVOLUT_WEBHOOK_URL`). The app registers it on connect. Paste it into Revolut only if registration fails and Settings shows the webhook warning.
- [ ] Supabase secrets (names only, set in the function secrets, never in the repo):
  - `REVOLUT_CLIENT_ID`
  - `REVOLUT_PRIVATE_KEY` (PEM, PKCS#1 from `openssl genrsa` or PKCS#8)
  - `REVOLUT_OAUTH_REDIRECT_URL`
  - `REVOLUT_WEBHOOK_URL`
  - `REVOLUT_JWT_ISSUER` (optional; otherwise the redirect host)
  - `REVOLUT_SANDBOX` (`true` for sandbox)
  - `APP_URL` (app origin, no path)
  - `REVOLUT_CRON_SECRET` (optional extra header for unattended calls)
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are already present
- [ ] Cron. About every 20 minutes, POST `revolut-token-refresh`. About every 15 minutes, POST `revolut-sync-transactions`. Access tokens last about 40 minutes. Send `Authorization: Bearer <service role>` because `verify_jwt` is on. Optional header `x-revolut-cron-secret: <REVOLUT_CRON_SECRET>`. Body may be `{}` (every active connection) or `{ "organization_id": "<uuid>" }`.
- [ ] Migration, then deploy. Apply `supabase/migrations/20261015190000_revolut_business.sql` by hand in the Dashboard, statement by statement. `user_can_view_org_finance(uuid)` must already exist or the migration raises. Do not `db push`. Then deploy functions, then the frontend.

One client id and one private key are one Revolut business. A second organisation cannot connect that same client id until the first disconnects. Per-organisation credentials are a follow-up if two workshops each have their own Revolut account.

`20261014200000` (manual payment insert) and `20261014200100` (`orders_with_balance`) are still separate and unapplied. Sync reads `orders_with_balance` and falls back if `person_name` is missing.

## Certificate

```bash
openssl genrsa -out privatecert.pem 2048
openssl req -new -x509 -key privatecert.pem -out publiccert.cer -days 1825
```

Upload `publiccert.cer`. Put the contents of `privatecert.pem` in `REVOLUT_PRIVATE_KEY`. Keep the private key off the repo and off the frontend.

## Redirect and webhook

Replace `<project-ref>` with this project's functions host. Do not commit the real ref.

- Redirect URI: `https://<project-ref>.supabase.co/functions/v1/revolut-oauth-callback`
- Webhook URL: `https://<project-ref>.supabase.co/functions/v1/revolut-webhook`

Sandbox hosts: API `https://sandbox-b2b.revolut.com`, consent `https://sandbox-business.revolut.com`. Production: `https://b2b.revolut.com` and `https://business.revolut.com`. The connection stores which one it used, and later calls stay on that host.

Webhook allowlist (Revolut's published addresses): `35.246.21.235`, `34.89.70.170`.

## What the app does

Connect (Settings → Integrations, admin or member) opens Revolut consent with `scope=READ`. The return lands on Settings → Integrations. Tokens sit on `revolut_connections` and are not readable from the browser. Refresh tokens are not given an expiry by Revolut; this app treats them as 90 days and warns at 14 days. Connect again before that. There is no separate "refresh token" button: the access token refreshes on sync and on the cron.

Sync and the webhook write `order_payments` with `source = revolut` and `external_id` = the Revolut transaction id. A completed payment auto-matches only when there is exactly one high-confidence order (order number in the reference, or the living customer's surname plus the amount within £0.01). Anything weaker waits in Finance → Reconcile. Pending never auto-matches. Declined, failed, and reverted are dismissed and do not count as cash in.

Accept updates that same row (`status = matched`). It does not insert another payment. Ignore sets `dismissed`. A second Accept of the same order is a no-op.

## Deploy order

1. Apply `20261015190000_revolut_business.sql` in the Dashboard.
2. `supabase functions deploy revolut-oauth-callback --no-verify-jwt`
3. `supabase functions deploy revolut-webhook --no-verify-jwt`
4. `supabase functions deploy revolut-oauth-start`
5. `supabase functions deploy revolut-sync-transactions`
6. `supabase functions deploy revolut-token-refresh`
7. `supabase functions deploy revolut-disconnect`
8. Deploy the frontend.
9. Schedule the two crons.
10. Connect from Settings on sandbox, Sync now, then confirm a payment in Reconcile.

`config.toml` pins `verify_jwt = false` for the callback and the webhook. A plain deploy turns JWT verification back on and those two return 401. The other four keep `verify_jwt` on.

Field-by-field mapping: `docs/revolut-field-mapping.md`.
