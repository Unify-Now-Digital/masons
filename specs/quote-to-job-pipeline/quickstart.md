# Quickstart: quote-to-job-pipeline cutover runbook

Single coordinated cutover window (~2 quotes/week arrival rate — pick a quiet hour; no
straggler handling needed). Giorgi drives every gate, git operation, and Dashboard apply.
Claude Code stops at each ☐ CHECKPOINT and waits.

## 0. Preconditions

- ☐ CHECKPOINT — Flags F1–F4 (plan.md) resolved by Giorgi.
- ☐ Arin WARNING delivered (not a permission request): edit-quote links will 404; inbox badge
  flip for 23 people; (+F3 orders-page change if opted in). Exhibits: spec §User-visible
  changes, research.md V2/F1.
- All frontend edits reviewed per-edit and merged into `feature/quote-to-job-pipeline`.
- Migration file exists at `supabase/migrations/20260820TTTTTT_quote_to_job_cutover.sql` with
  evidence-header SKELETON (placeholders, no fabricated numbers) and LF line endings
  (`git ls-files --eol` shows `w/lf`, or normalize before apply — CRLF learning 19 Aug).

## 1. Commit + push (Giorgi, explicit paths)

```bash
git add supabase/migrations/20260820TTTTTT_quote_to_job_cutover.sql \
        src/modules/orders/api/orders.api.ts \
        src/shared/types/database.types.ts \
        <orders type file per tasks.md>
git commit   # migration file committed BEFORE Dashboard apply — record-of-truth discipline
git push
```

## 2. Dashboard apply (Giorgi, statement by statement — editor auto-commits each)

Order matters; S-numbers refer to the migration file's sections (plan.md §Migration design):

1. **S0 partition SELECT** — run; paste output into the migration evidence header. Confirm the
   23-person set and the A/B split match expectations. ☐ CHECKPOINT if counts surprise
   (e.g. persons ≠ 23, or active-job counts contradict F1's read of the 1-Aug backfill).
2. **S1** add `orders.archived_at` → read-back `information_schema.columns`.
3. **S2** `CREATE OR REPLACE create_quote` → read-back `pg_get_functiondef` (LF check: no
   `\r`), ACL still service_role-only, body contains no `insert into public.orders`.
   From this statement on, no new quote-orders can arrive — backfill window is race-free.
4. **S3–S7** for EACH: run the dry-run SELECT (paste output) → run the guarded DML with
   `RETURNING` (paste rows-affected + ids) → confirm count matches the dry-run prediction.
   "Applied" ≠ "rows affected" — a 0-row UPDATE's "Success" is a failure here.
5. **S8 read-back suite** — paste all outputs:
   - 23 persons each with ≥1 active job, `enquiry_id` = their latest quote enquiry
   - 0 quote orders with `archived_at IS NULL`; 0 with `job_id IS NULL`
   - 0 `inbox_conversations` org-wide stamped with an archived quote-order id
   - Churchill sanity: jobs/orders/inbox_conversations counts UNCHANGED
6. Update the migration file's evidence header with everything pasted; commit the evidence
   update (Giorgi).

## 3. Live verification (staging build against prod data)

- Inbox: the 23 people's conversations show **Enquiry** (was "Existing order"); a person with a
  real open order still shows "Existing order".
- Submit a real portal quote (or coordinate one): person + job('enquired') + enquiry appear; NO
  orders row; conversation arrives web-channel, linked, bucketed 'enquiry'. Submit again →
  same job re-used, `enquiry_id` repointed (FR-004).
- P2: create an order for a job-less person (Grigorescu repro) → job auto-created and
  auto-advanced to 'quoted'; create an order for a person with an existing job → no duplicate.
- Regression checklist in plan.md §Regression — walk every row.

## 4. Gates (Giorgi runs; Claude Code predicts, never self-runs)

```bash
npx tsc --noEmit -p tsconfig.app.json   # pass = 55 pre-existing errors, 0 new
npm run lint                            # pass = 10 errors / 16 warnings baseline
# deno gate: no edge functions touched this cycle — trivially clean, state it in the PR
```

## 5. Merge (Giorgi)

- PR `feature/quote-to-job-pipeline` → `staging` (trunk is staging, not main).
- PR notes: link spec + plan; list the two (or three, with F3) user-visible changes; note the
  SearsMelvin revert risk (`2026-05-20-create-quote-rpc.sql`) and the Wednesday shared-schema
  protocol conversation as its mitigation; note the enum-enforcement follow-up is now unblocked.

## Rollback map

| Step | Revert |
|------|--------|
| S1 | keep (harmless) or `alter table public.orders drop column archived_at` |
| S2 | re-run `20260819120000_org_scope_create_quote_person_dedupe.sql` (restores order-creating version — same file that constitutes the documented revert RISK) |
| S3 | delete inserted jobs by RETURNING ids (Dashboard/service-role only — no DELETE policy) |
| S4–S7 | restore prior values from RETURNING output recorded in the evidence header |
| Frontend | revert the commit (Giorgi) |
