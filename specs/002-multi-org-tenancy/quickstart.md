# Quickstart: Multi-Organization Tenancy (development)

**Branch**: `002-multi-org-tenancy`  
**Date**: 2026-04-11

## Prerequisites

- Local Supabase or linked project with migration access; apply migrations through `20260411140900_refresh_orders_views_after_org_id.sql` (and earlier `20260411140*` org tenancy files) before testing the app.
- App env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and functions URL if testing Edge Functions)

## After migrations land

1. **Verify default org**: Query `organizations` for name **Churchill**; confirm historical rows have `organization_id` set.
2. **Verify membership**: Confirm your test user has a row in `organization_members` for Churchill (or target org) with expected `role`.
3. **Run app**: Sign in; `useOrganization` (or equivalent) should show active org; lists (orders, inbox, etc.) should only return rows for that org.
4. **Switch org** (multi-membership user): Change active org in sidebar; React Query caches should invalidate or refetch; no cross-tenant data visible.
5. **RLS spot-check**: In SQL editor as anon with user JWT, `select` from a tenant table should not return other orgs’ rows.

## Manual provisioning (no self-serve)

- Create org: insert into `organizations`.
- Add user to org: insert into `organization_members` with `role`.

## Troubleshooting

- **Empty lists**: Missing `organization_id` on inserts, or membership row absent, or RLS too strict.
- **403 / empty from Edge Function**: Service role path missing membership verification.
- **Stale UI after org switch**: Ensure query keys include `organizationId` and invalidation runs on switch.
