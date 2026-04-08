# Contract: `sentry-proxy` (Supabase Edge Function)

**Base URL**: `{VITE_SUPABASE_FUNCTIONS_URL}/sentry-proxy`  
**Auth**: `Authorization: Bearer <supabase_access_token>`  
**CORS**: `Access-Control-Allow-Origin: *` (or restricted later); allow methods **GET**, **OPTIONS**; headers include `authorization`, `apikey`, `content-type`, `x-client-info`.

## Admin enforcement

- Caller must be authenticated.
- Caller email (`user.email`, trimmed + lowercase) must appear in **`ADMIN_EMAILS`** secret (`comma-separated`).
- Failure: **403** JSON `{ "error": "Forbidden" }` (message may be generic).

## Operations (query parameter `op`)

### `GET .../sentry-proxy?op=issues`

**Query parameters**:

| Name   | Required | Description |
|--------|----------|-------------|
| `op`   | yes      | literal `issues` |
| `limit`| no       | Max rows (default 25, cap 100) |

**Success 200** — body matches **`SentryIssuesResponse`** (see [data-model.md](../data-model.md)).

**Errors**:

| Code | When |
|------|------|
| 401  | Missing/invalid JWT |
| 403  | Not admin |
| 500  | Missing Sentry secrets or misconfiguration |
| 502  | Sentry upstream error (optional detail in body, no token) |

---

### `GET .../sentry-proxy?op=stats`

**Query parameters**:

| Name | Required | Description |
|------|----------|-------------|
| `op` | yes      | literal `stats` |

**Success 200** — body matches **`SentryStatsResponse`** (period + series arrays).

**Errors**: Same as issues endpoint.

---

## Secrets (server-only)

| Secret | Purpose |
|--------|---------|
| `SENTRY_AUTH_TOKEN` | Sentry API bearer token |
| `SENTRY_ORG_SLUG` | Organization slug |
| `SENTRY_PROJECT_SLUG` | Project slug |
| `ADMIN_EMAILS` | Comma-separated admin emails (mirror `VITE_ADMIN_EMAIL`) |

## OPTIONS

Return **200** with CORS headers for preflight.
