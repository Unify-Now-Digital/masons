# Contract: stripe-org-config Edge Function

**Purpose**: Platform operators register or rotate per-organisation Stripe credential sets and toggle live payments.

## Endpoint

`POST /functions/v1/stripe-org-config`

## Authentication

- **Primary**: Supabase JWT; caller email MUST be in `ADMIN_EMAILS` (comma-separated, case-insensitive trim) — same pattern as `sentry-proxy`.
- **Alternative (optional / discouraged for v1)**: `X-Admin-Token` matching `INBOX_ADMIN_TOKEN` for scripted onboarding. This token guards the ability to write live Stripe secret keys and toggle live payments. For the v1 two-org pilot, **prefer JWT + `ADMIN_EMAILS` only**. If the scripted path is retained, `INBOX_ADMIN_TOKEN` must be strong and stored in Bitwarden.

## Request body

```json
{
  "organization_id": "uuid",
  "action": "upsert_credentials" | "enable_live" | "disable_live",
  "test_secret_key": "sk_test_…",
  "test_publishable_key": "pk_test_…",
  "test_webhook_secret": "whsec_…",
  "live_secret_key": "sk_live_…",
  "live_publishable_key": "pk_live_…",
  "live_webhook_secret": "whsec_…"
}
```

- `upsert_credentials`: requires all six key fields (partial patch optional in v1 — full replace acceptable). On any credential upsert/rotation, the server MUST reset `test_round_trip_passed_at` to NULL, so a fresh test-mode round trip is required against the new credentials before live can be (re-)enabled.
- `enable_live`: body may omit keys; server checks `test_round_trip_passed_at IS NOT NULL` and live triplet present; sets `live_payments_enabled = true`.
- `disable_live`: sets `live_payments_enabled = false`; does not delete credentials.

## Responses

| Status | Body |
|--------|------|
| 200 | `{ "ok": true, "organization_id": "…", "live_payments_enabled": boolean }` |
| 400 | `{ "error": "test_round_trip_required" }` — enable_live blocked |
| 400 | `{ "error": "mode_mismatch", "detail": "…" }` — key prefix wrong for mode |
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Forbidden" }` — not platform admin |
| 404 | `{ "error": "Organization not found" }` |

**Notes**: `enable_live` requires a test round trip recorded **after** the most recent credential change (`test_round_trip_passed_at` non-null and set only since the last `upsert_credentials`).

## Security

- Never return secret keys or webhook secrets in response.
- Encrypt secrets server-side before upsert; log only `organization_id` + action.
- CORS: same as other admin Stripe functions.
