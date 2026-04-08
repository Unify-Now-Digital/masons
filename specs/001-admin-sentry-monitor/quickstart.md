# Quickstart: Admin Sentry monitoring

**Branch**: `001-admin-sentry-monitor`

## Prerequisites

- Supabase project with Edge Functions enabled
- Sentry org + project with **Auth Token** (API access)
- App already uses `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_FUNCTIONS_URL`, `VITE_ADMIN_EMAIL`

## 1. Supabase secrets

```bash
supabase secrets set SENTRY_AUTH_TOKEN=<sentry_auth_token>
supabase secrets set SENTRY_ORG_SLUG=<org_slug>
supabase secrets set SENTRY_PROJECT_SLUG=<project_slug>
supabase secrets set ADMIN_EMAILS=<same_as_vite_admin_list>
```

`ADMIN_EMAILS` must use the **same comma-separated emails** as `VITE_ADMIN_EMAIL` (trim/lowercase normalization applied at runtime).

## 2. Deploy function

```bash
supabase functions deploy sentry-proxy --no-verify-jwt
```

Use project defaults for JWT verification **or** enable verify-jwt if your gateway requires it; the function body still validates the user with `getUserFromRequest`.

## 3. Frontend `.env`

No Sentry token in Vite. Ensure:

```env
VITE_SUPABASE_FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1
VITE_ADMIN_EMAIL=admin@example.com
```

(Comma-separated for multiple admins.)

## 4. Local verification

1. Sign in as **non-admin** → open `/dashboard/sentry-monitor` → should **redirect** away; direct `fetch` to `sentry-proxy` with non-admin JWT → **403**.
2. Sign in as **admin** → Monitoring link visible in **Review Nav** → page loads issues + stats.
3. DevTools **Network** → responses contain **no** Sentry token.

## 5. Troubleshooting

| Symptom | Check |
|---------|--------|
| 403 always | `ADMIN_EMAILS` vs user email; JWT present |
| 502 from proxy | Sentry token, org/project slugs; Sentry project exists |
| Empty issues | Sentry project has no issues; `limit` param |
