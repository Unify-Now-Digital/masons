---
name: schema-inventory
description: Live-catalog inventory of every public table (rows, scan stats, dependencies, grants, policies) cross-referenced with code usage in Mason and ../SearsMelvin, classified DROP / ARCHIVE-THEN-DROP / KEEP / UNKNOWN with evidence. Read-only. Output docs/schema/inventory-YYYY-MM-DD.md.
---

Read-only; never edits `src/`, `supabase/`, or the database. This skill classifies; it never drops. Output written by CC to `docs/schema/inventory-<today>.md` after Giorgi sees it.

## Purpose
Evidence base for the Day-9 schema cleanup: which public tables are live, which are dead, and what would break if each were removed.

## Inputs
None. Date from today's session date (`YYYY-MM-DD`).

## Steps
1. Dispatch `auditor` with this brief:
   > Run via supabase-ro, all read-only:
   > (1) `SELECT relname, n_live_tup, n_dead_tup, seq_scan, idx_scan, last_autoanalyze, last_autovacuum FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY relname`.
   > (2) Per-table dependency tree, one query each: views — `SELECT viewname FROM pg_views WHERE schemaname='public' AND definition ILIKE '%<table>%'`; triggers — `SELECT tgname, tgrelid::regclass, tgfoid::regproc FROM pg_trigger WHERE NOT tgisinternal`; FKs in and out — `SELECT conname, conrelid::regclass, confrelid::regclass FROM pg_constraint WHERE contype='f'`; policies — `SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname='public'`; functions referencing the table — `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND pg_get_functiondef(p.oid) ILIKE '%<table>%'`; other objects — `pg_depend` joined to `pg_class` for `refobjid = '<table>'::regclass`.
   > (3) Grants: `SELECT grantee, table_name, string_agg(privilege_type, ',') FROM information_schema.role_table_grants WHERE table_schema='public' GROUP BY 1,2`.
   > (4) `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'`.
   > Then grep each table name (word-bounded, case-insensitive) in this repo (`src/`, `supabase/`, excluding `node_modules`, `dist`, `specs/_archive`) and in `../SearsMelvin` (whole tree, all extensions, excluding `node_modules`) — report line-counted hits per repo, and separately whether any hit is a `.from('<table>')`/`.rpc` call vs a mention in docs/migrations.
   > Do not query row contents of any table. Counts and catalog metadata only. Standard output format.
2. CC classifies each table with the evidence columns and writes the doc:
   - `| table | n_live_tup | seq/idx scan | last_autoanalyze | Mason hits (code/other) | SM hits (code/other) | views | triggers | FKs in/out | policies | RLS | grants | class | reason |`
   - Classes: **KEEP** — code hits in either repo, or a dependency that is itself KEEP. **ARCHIVE-THEN-DROP** — zero code hits in both repos, rows > 0. **DROP** — zero code hits, zero rows, no inbound dependency. **UNKNOWN** — conflicting or missing evidence (e.g. dynamic table names, RPC-only access); state what would resolve it.
   - Header: date, project ref placeholder, query list, both repo paths, caveat that `n_live_tup` is an estimate and that "unused by Mason ≠ unused" (SearsMelvin, edge functions, Dashboard SQL).
   - `## Open questions` from the auditor.
3. Show the file to Giorgi before writing.

## Output
`docs/schema/inventory-YYYY-MM-DD.md`. No other file changes. Never proposes DDL in this document; the Day-9 spec does that.

## Rules
- Read-only; never edits `src/`. No `DROP`, `ALTER`, or row-content reads.
- Placeholders only for org ids and project ref.
- Any table with live rows in `organization_id IN ('<SM>','<CHURCHILL>')` can never be classed DROP.
