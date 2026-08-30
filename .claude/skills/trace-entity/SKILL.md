---
name: trace-entity
description: Trace every write path and status value for one entity (job | order | invoice | payment) — Mason + SearsMelvin code vs live DB constraints — and write docs/traces/<entity>.md with a Mermaid state diagram. Read-only.
argument-hint: job | order | invoice | payment
---

Read-only; never edits `src/`. Output goes only to `docs/traces/<entity>.md`, written by CC from the auditor's report after Giorgi sees it.

## Purpose
One document per entity that answers: where is it written, with which fields, under which org guard, invalidating which query keys — and whether the status/stage vocabulary agrees across TS types, Zod schemas and the database.

## Inputs
`$ARGUMENTS` = one of `job`, `order`, `invoice`, `payment`. Table sets (re-verify with grep before trusting):
- job → `jobs`, `job_workers`
- order → `orders`, `order_people`, `order_payments`
- invoice → `invoices`, `invoice_payments`
- payment → `payments`, `order_payments`, `invoice_payments`
Plus any RPC whose name or body touches those tables (`.rpc('…')` sites in Mason and `../SearsMelvin`; function bodies in `supabase/migrations/` and `../SearsMelvin/migrations/`).

## Steps
1. Dispatch `auditor` with this brief (verbatim, entity substituted):
   > Entity: `<entity>`, tables: `<list>`. (a) Grep every `.from('<table>')` followed by `.insert`/`.update`/`.upsert`/`.delete`, every `.rpc('<name>')` touching these tables, and every edge function under `supabase/functions/` and `../SearsMelvin/functions/` that writes them. For each write site: `file:line`, operation, fields written (explicit list; note `...spread` sources), org guard present at the query layer (yes/no + line), query keys invalidated after the mutation (list; flag if person-keyed probe keys such as `useJobsByPersonId` are missing where CLAUDE.md requires them). (b) Collect every status/stage/state value: TS union types (`src/modules/<feature>/types`), Zod enums (`src/modules/<feature>/schemas`), DB — run against supabase-ro: `SELECT conrelid::regclass, conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE contype='c' AND conrelid IN (<tables>::regclass)` and `SELECT t.typname, e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid` filtered to types used by those tables' columns (`information_schema.columns`). Also `SELECT status, count(*) FROM <table> WHERE organization_id IN ('<SM>','<CHURCHILL>') GROUP BY 1` per status column so unused values are visible. Flag drift: any value present in one source and absent in another. (c) List transitions you can evidence from code (`status: 'x'` writes conditioned on a prior status) as `from → to (file:line)`; do not invent transitions. Standard output format; every claim with file:line or query → N rows; placeholders for org ids in the report.
2. CC assembles `docs/traces/<entity>.md`:
   - Header: entity, date, tables, sources searched (both repos), row counts per status (live orgs only, placeholders).
   - `## Write sites` table: `| file:line | op | fields | org guard | keys invalidated | notes |`
   - `## Status vocabulary` table: `| value | TS type | Zod | DB CHECK/enum | live rows | drift |`
   - `## State diagram` — Mermaid `stateDiagram-v2` built only from evidenced transitions; unreachable values listed under the diagram as "declared, no transition found".
   - `## Open questions` from the auditor.
3. Show the file to Giorgi before writing.

## Output
`docs/traces/<entity>.md`. No other file changes.

## Rules
- Read-only; never edits `src/`. Auditor SQL is SELECT-only and org-scoped to the two live orgs via placeholders from `CLAUDE.local.md`.
- No customer names/emails in the output — ids, numbers, counts only.
- A write site existing is not evidence it runs; the live row counts are the evidence.
