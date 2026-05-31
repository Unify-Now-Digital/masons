# Quickstart: GHL Multi-org credentials

## Prerequisites

- Phase 1 GHL Inbox merged on staging (`009-ghl-inbox-readonly`)
- Branch `010-ghl-multi-org`
- Churchill `ghl_connections` row exists (needs `ghl_api_key` populated)
- PIT + location ID for Churchill and Sears Melvin (user-held, not in git)
- One **encryption key** (strong random) — used for Edge secret and Dashboard seed SQL

## Deploy order

1. Commit migration `*_ghl_connections_api_key.sql`
2. **User**: Apply migration in Supabase Dashboard SQL Editor (`bfwohzcugtwbhhxdqgme`)
3. **User**: Set Edge secret `GHL_API_KEY_ENCRYPTION_KEY` (same value you will paste into seed SQL)
4. **User**: Seed encrypted PITs for Churchill + insert Sears Melvin row (Dashboard SQL)
5. Deploy `ghl-fetch`, `ghl-mark-read` (and `ghl-webhook` if bundled)
6. Smoke: both orgs at `/dashboard/ghl-inbox`

## Seed SQL (Dashboard only — replace placeholders)

Use the **same** encryption key string as `GHL_API_KEY_ENCRYPTION_KEY`. Do not commit keys or PITs to git.

```sql
update public.ghl_connections
set ghl_api_key = extensions.pgp_sym_encrypt('<CHURCHILL_PIT>', '<encryption-key>')
where organization_id = '<CHURCHILL_ORG_UUID>';

insert into public.ghl_connections (organization_id, ghl_location_id, status, ghl_api_key, last_verified_at)
values (
  '<SEARS_ORG_UUID>',
  '<SEARS_GHL_LOCATION_ID>',
  'active',
  extensions.pgp_sym_encrypt('<SEARS_PIT>', '<encryption-key>'),
  now()
);
```

Verify decrypt (service role / SQL Editor):

```sql
select public.get_ghl_api_key(
  p_connection_id := '<connection_uuid>'::uuid,
  p_encryption_key := '<encryption-key>'
);
```

## Smoke tests

| Check | Expected |
|-------|----------|
| Churchill member → GHL Inbox | Churchill conversations only |
| Sears Melvin member → GHL Inbox | Sears conversations only |
| Mark as read | Works per org |
| `npm run build` + grep | No PIT strings in `dist/` |

## Deprecated secrets

`GHL_API_KEY` and `GHL_LOCATION_ID` remain in Supabase for rollback; Edge code no longer reads them.
