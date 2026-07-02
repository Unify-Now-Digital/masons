# Security finding: cross-tenant read leak on 5 org-scoped relations

**Status:** RESOLVED — fix applied with Arin sign-off, re-tested green, own-org data verified intact
**Severity:** High (4 views — confirmed cross-tenant financial-data read) + Low/design (cemeteries — authenticated-only, intentional sharing)
**Found:** RLS isolation read sweep against production (`bfwohzcugtwbhhxdqgme`)
**Scope of fix:** Production schema change — requires Arin sign-off before applying

---

## TL;DR

An authenticated user belonging to **only** a throwaway test org was able to read **Sears Melvin** rows from 5 relations. 36 of 41 org-scoped relations correctly isolated; 5 leaked. Root cause splits into two distinct issues:

- **4 views** (`invoices_with_breakdown`, `orders_with_balance`, `orders_with_options_total`, `v_orders_with_stage`) lack `security_invoker`, so they run as the view owner and ignore the caller's RLS. Their underlying tables (`orders`, `invoices`, etc.) all isolate correctly — the data is protected at the table and handed out the side door by the view.
- **1 table** (`cemeteries`) carries a `USING (true)` SELECT policy (`cemeteries_public_read`). This is **intentional** — cemeteries are designed as shared cross-org reference data (migration `20260402120000`). Not a bug to patch blindly; a design decision to confirm.

---

## How it was found (and why the result is trustworthy)

A read-only harness logged in as an **isolated user** (member of exactly one org: NEW TEST ORG 2, `76320b08-…`) and requested every org-scoped relation filtered to **Sears Melvin** (`3770972d-…`), expecting `[]` everywhere.

**Positive control:** the same sweep also queried the isolated user's *own* org. `organization_members` returned 2 own-org rows — proving the token was live and genuinely seeing its own org. This rules out the "dead token returns [] everywhere, looks like perfect isolation" false-pass. The PASSes are real; the FAILs are real.

For each FAIL the harness confirmed the returned rows actually carry Sears Melvin's `organization_id` before flagging — not a column-name coincidence.

---

## Findings

| Relation | Type | Foreign rows leaked | Verdict |
|---|---|---|---|
| `invoices_with_breakdown` | view | 5 | LEAK — financial data |
| `orders_with_balance` | view | 5 | LEAK — financial data |
| `orders_with_options_total` | view | 5 | LEAK — order/financial data |
| `v_orders_with_stage` | view | 5 | LEAK — order data |
| `cemeteries` | table | 5 | Shared by design — confirm intent |

All other 36 org-scoped relations returned `[]` (isolation holds), including the base tables `orders`, `invoices`, `payments`, `people`, `enquiries`, `inbox_*`.

---

## Root cause A — views missing `security_invoker` (4 relations)

Confirmed via:
```sql
select c.relname, c.reloptions from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relname in
('invoices_with_breakdown','orders_with_balance','orders_with_options_total','v_orders_with_stage');
-- reloptions = null on all four
```
On Postgres 15+, a view without `security_invoker = on` executes with the **view owner's** privileges and bypasses the caller's RLS. Server is **17.6**, so the one-line fix is available.

**Who reads these views (grep `src/` + `supabase/functions/`):**
- **Frontend (authenticated user sessions):** finance, payments, reporting, priority, invoicing, map, hub modules. These are the reads currently leaking — and they should only ever show the caller's own org. `security_invoker` makes that correct.
- **Edge functions (service-role key):** `revolut-sync-transactions`, `revolut-webhook`, `stripe-create-checkout-session`, `stripe-create-invoice`, `stripe-create-invoice-payment-link`. Service-role **bypasses RLS regardless**, so `security_invoker` does not change their behaviour — they keep working.

**Impact:** Net effect of the fix is "authenticated frontend reads get correctly org-filtered; backend Stripe/Revolut jobs unaffected." Underlying tables already isolate correctly (verified), so the views have correct per-caller RLS to inherit.

**Churchill relevance:** Churchill is empty today, so nothing leaks *yet*. But the bypass is structural — once Churchill has live invoices/orders, these four views expose its financials to any authenticated user of any org. Worth fixing before Churchill accumulates data.

### Fix (PG 17.6)
```sql
alter view invoices_with_breakdown   set (security_invoker = on);
alter view orders_with_balance       set (security_invoker = on);
alter view orders_with_options_total set (security_invoker = on);
alter view v_orders_with_stage       set (security_invoker = on);
```

---

## Root cause B — cemeteries `USING (true)` policy (1 relation)

`cemeteries` has RLS **on** (`relrowsecurity = true`) with a correctly-scoped `cemeteries_org_select` policy — **plus** a second permissive SELECT policy `cemeteries_public_read` with `qual = true`. Postgres ORs permissive policies for the same command, so the effective rule is `user_is_member_of_org(org) OR true` → `true`. The org check is dead weight.

**This is intentional, not an accident.** Code comments:
- `permitTracker/hooks/useCemeteries.ts`: *"Cemeteries table is currently org-agnostic (see migration 20260402120000)…"*
- `cemeteries/hooks/useCemeteries.ts`: *"Cemeteries are shared reference data — show every row regardless of org."*

The permit tracker and inbox bucket classifier rely on fetching **all** cemeteries org-agnostically. Dropping `cemeteries_public_read` blindly would scope cemeteries per-org and break that intended sharing.

**The decision for Arin:** keep cemeteries shared across orgs, or make them org-scoped?
- Cemetery records carry `primary_email`, `phone`, `address`, `council`, and `notes`. Names/addresses/councils are effectively public reference data — sharing is defensible. The one concern is `notes`, which could hold org-private commentary visible to other orgs.
- **Keep shared** → no code change; document that cemeteries are intentionally cross-org; treat `notes` as non-private (or move private notes elsewhere).
- **Make org-scoped** → `drop policy cemeteries_public_read on cemeteries;` AND update `permitTracker/hooks/useCemeteries.ts` (and the inbox bucket build) to expect only the caller's org's cemeteries. This is a behaviour change, not just a policy drop.

### Role check — RESOLVED
The permissive policy targets `{authenticated}` only (verified via `pg_policies`). Cemeteries are readable cross-org by **logged-in users only** — **not** by the anon key / unauthenticated internet. This is the milder case: it confirms the deliberate shared-reference design and rules out public exposure. No security hole; product decision only.

---

## Remediation summary

| Item | Action | Needs |
|---|---|---|
| 4 views | `set (security_invoker = on)` | Arin sign-off; low risk |
| cemeteries | Confirm shared-vs-scoped + resolve the anon-role open check | Arin product decision |

Apply via Supabase Dashboard SQL editor (per your migration convention — manual, not `db push`). Each `alter view` auto-commits.

---

## Re-test plan

After applying the view fix, re-run the harness with the same isolated-user token:
```
node rls-isolation-harness.mjs
```
Expect the four views to flip from `FAIL` to `PASS`. The positive control (`organization_members` OWN ≥ 1) must still show the token is live, or the re-test proves nothing. `cemeteries` will stay `FAIL` until/unless the sharing decision changes it — that's expected, not a regression.

---

## Resolution (applied)

Four `alter view … set (security_invoker = on)` statements applied via dashboard SQL editor with Arin sign-off.

**Re-test result:** all four views flipped `FAIL → PASS`. Positive control live (`organization_members` OWN = 2), so the PASSes are real, not a dead-token artifact. Only remaining `FAIL` is `cemeteries` (shared by design — expected).

**Own-org smoke test (real multi-org user, Sears Melvin active):**
- Finance — 5 invoices, £58,236 total balance, £4,713 invoiced — renders.
- Reporting — 9 orders, £39,175 top products, £15,401 revenue chart — renders.
- Payments — Outstanding (14), £58,236.20 balance — renders.

Confirms `security_invoker` did not over-filter legitimate own-org reads. Pre-existing `£0.00` invoice totals (web-form `LEFT JOIN orders` null bug) and empty reconciliation are unrelated backlog items, not caused by this change.

---

## Not yet tested (next phases)

- **Write isolation** (insert-side `WITH CHECK`): can an isolated user `POST`/`PATCH` a row stamped with another org's `organization_id`? Runs against the **two test orgs only** — never Sears Melvin or Churchill.
- **Edge-function auth:** `ghl-webhook` runs `--no-verify-jwt`; confirm it has its own signature/secret check or it accepts unauthenticated POSTs for any org. Stripe webhook signature enforcement.
- **Secrets:** full git-history trufflehog pass (the two revoked `sbp_` PATs are a separate Arin-coordinated scrub).