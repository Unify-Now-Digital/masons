# Contract: Per-org GHL credentials (multi-org)

## Storage

| Field | Table | Access |
|-------|-------|--------|
| Encrypted PIT | `public.ghl_connections.ghl_api_key` (`bytea`) | Service role decrypt only |
| Location ID | `public.ghl_connections.ghl_location_id` | Members read via RLS |

Encryption (Dashboard seed SQL): `extensions.pgp_sym_encrypt('<pit>', '<encryption-key>')` — same string as Edge secret `GHL_API_KEY_ENCRYPTION_KEY`.

## RPC: `get_ghl_api_key(p_connection_id uuid, p_encryption_key text) → text`

PostgREST resolves RPC arguments **by parameter name** — callers must use the `p_` prefix matching the SQL definition.

- **Caller**: Edge Functions with `SUPABASE_SERVICE_ROLE_KEY` only
- **Parameters**:
  - `p_connection_id` — `ghl_connections.id`
  - `p_encryption_key` — from `Deno.env.get('GHL_API_KEY_ENCRYPTION_KEY')` (single source of truth)
- **Returns**: Decrypted PIT or null if column null
- **Errors**: Empty `p_encryption_key`; decrypt failure

No Postgres GUC or `current_setting` — the key is passed per call.

## Edge: `ghlFetch(path, apiKey, init?)`

- `apiKey` is the decrypted PIT for the active org connection
- Must **not** read `Deno.env.get('GHL_API_KEY')`

## Edge: `getActiveGhlConnectionWithKey(supabase, organizationId)`

Returns:

```typescript
{
  connection: { id, organization_id, ghl_location_id, status };
  apiKey: string;
} | null
```

Flow:

1. Read `GHL_API_KEY_ENCRYPTION_KEY` from env; fail if missing
2. `select` active row for `organization_id`
3. `.rpc('get_ghl_api_key', { p_connection_id: connection.id, p_encryption_key: encryptionKey })`
4. Fail if `apiKey` empty

## Deprecated environment secrets

| Secret | Status |
|--------|--------|
| `GHL_API_KEY` | Deprecated — keep in Supabase, not read |
| `GHL_LOCATION_ID` | Deprecated — keep in Supabase, not read |
| `GHL_API_KEY_ENCRYPTION_KEY` | **Required** — sole encryption key source |

## Webhook

`ghl-webhook` does not call `ghlFetch`. Routes inbound events by payload `locationId` → `update ghl_connections` where `ghl_location_id` matches. No change for multi-org.

## Frontend

`fetchGhlConnection` selects metadata columns only — **never** `ghl_api_key`.
