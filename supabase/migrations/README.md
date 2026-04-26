# Supabase Migrations

Migrations from the 2026-04-26 security & performance audit.

## Applied here

| File | What it does |
|---|---|
| `20260426120001_scope_anon_rls_policies.sql` | Replaces `ALL`-to-anon RLS on `password_reset_tokens`, `admin_sessions`, `partner_sessions`, `partners` with INSERT+SELECT only (SELECT only for `partners`). |
| `20260426120002_pin_function_search_paths.sql` | Sets `search_path = public` on `set_updated_at`, `jsonb_diff_rows`, `activity_log_write`, `log_activity_generic`. |
| `20260426120003_add_missing_fk_indexes.sql` | Adds 14 missing foreign-key indexes (9 × `organization_id`, 5 × relationship FKs). |

## Deliberately NOT included — needs a decision

- **`memorials` open RLS.** The audit flagged `Allow all access to memorials` as fully open to all roles. The audit notes this may be intentional given the custom auth model. Confirm with Arin before locking down.
- **Leaked password protection.** Dashboard toggle, not SQL — enable in Supabase Dashboard → Authentication → Password Settings.
- **`storage.objects` `Public can view product images` policy.** Only restrict if filenames are sensitive. No change made.
- **`pg_graphql` extension.** Only drop if the app does not use GraphQL. No change made.

## Applying

From a session with the Supabase MCP registered:

```
Apply each file in this directory via apply_migration in timestamp order.
```

Or via Supabase CLI:

```
supabase db push
```
