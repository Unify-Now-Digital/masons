# Data Model: GHL Multi-org credentials

## `public.ghl_connections` (delta)

| Column | Type | Notes |
|--------|------|-------|
| `ghl_api_key` | `bytea` | `pgp_sym_encrypt(pit, encryption_key)` at seed time; **never** selected by authenticated clients |

Existing columns unchanged: `organization_id` (unique), `ghl_location_id`, `status`, `last_verified_at`, timestamps.

## `public.get_ghl_api_key(p_connection_id uuid, p_encryption_key text) → text`

- **SECURITY DEFINER**, `search_path = ''`
- `pgp_sym_decrypt(ghl_api_key, p_encryption_key)` for the given connection id
- **EXECUTE** granted to `service_role` only (not `authenticated` / `anon`)
- `p_encryption_key` supplied by Edge from `GHL_API_KEY_ENCRYPTION_KEY` (PostgREST arg names must match)

## Edge secrets

| Secret | Role |
|--------|------|
| `GHL_API_KEY_ENCRYPTION_KEY` | **Required** — passed to RPC; used in Dashboard seed SQL |
| `GHL_API_KEY` | **Deprecated** — kept in dashboard, not read by code |
| `GHL_LOCATION_ID` | **Deprecated** — kept in dashboard, not read by code |

## Logical type (Edge)

```typescript
type ActiveGhlConnection = {
  connection: GhlConnectionRow;
  apiKey: string; // decrypted PIT, memory only
};
```
