# Tasks: Quote-to-Job Pipeline

**Input**: Design documents from `specs/quote-to-job-pipeline/` (spec.md, plan.md, research.md
incl. V3, data-model.md, contracts/create_quote.md, quickstart.md)
**Branch**: `feature/quote-to-job-pipeline`

## ⛔ PROTOCOL (verbatim — governs every task below)

**STOP at checkpoint tasks and WAIT for Giorgi.** Predictions before every apply — every edit
states its expected exact-match count and every DML statement its expected row count BEFORE
running; a failed exact-match or a surprising count is a full stop, not a retry. Giorgi runs
all gates (`npx tsc --noEmit -p tsconfig.app.json` = 55 baseline, lint = 10 err/16 warn, deno
trivially clean — no edge functions this cycle) and ALL git operations, with explicit paths.
Migration files committed with evidence headers BEFORE Dashboard apply; LF-normalize migration
bodies before apply (CRLF learning 19 Aug). Per-edit approval applies to every file change.
Org guard on every DML statement: SM `3770972d-1bbd-417b-b413-297e844db285`; Churchill has zero
portal quotes — the backfill is SM-only. Flags F1–F4: RESOLVED by Giorgi 20 Aug (plan.md
§Flags); V3 details question RESOLVED 20 Aug (research.md §V3 — no S4b, details-based config
flow stands).

**F1 hard requirement**: S0's partition output MUST be pasted into the migration evidence
header BEFORE S3/S4 run — the create-vs-attach split is recorded fact, not inference.

Story labels: **US1** = portal quote creates job not order (P1) · **US2** = manual order
auto-creates job (P2) · **US3** = backfill/cutover (P1, same window as US1). US1 and US3 share
ONE migration file — their migration tasks are sequential by design, not [P].

---

## Phase 1: Docs sync (Setup)

- [x] T001 Amend `specs/quote-to-job-pipeline/spec.md` SC-002 with the F1 resolution: add
      "(F1, 20 Aug: read as END-STATE invariant — 23 persons each with ≥1 active job attached
      to their latest quote enquiry; create-vs-attach split recorded by the S0 partition
      SELECT — not '23 rows inserted')". One edit, expected match count 1. Per-edit approval.
- [x] T002 Mark plan.md Progress Tracking: F1–F4 resolved (20 Aug), V3 resolved. One edit,
      expected match count 1. Per-edit approval.

**Checkpoint T002-C**: none — docs-only phase, proceed.

---

## Phase 2: Frontend implementation (US2 + read-path; NO deploy dependency yet)

⚠️ Ordering constraint (plan §Frontend): the `.is('archived_at', null)` filters MUST NOT reach
a deployed build before migration S1 adds the column (PostgREST errors on unknown column).
Safe here because merge-to-staging is the LAST cutover step (quickstart §5). State this in the
PR description.

- [x] T003 [US1/US3] Edit `src/modules/orders/api/orders.api.ts`: add
      `.is('archived_at', null)` to `fetchOrdersByPersonId` (after `.eq('organization_id', …)`
      at ~:174) and to `fetchOrdersByPersonIds` (after `.in('person_id', …)` at ~:203). Two
      separate Edit calls, each old_string unique (expected match count 1 each — the two
      functions' query chains differ by `.eq('person_id'...)` vs `.in('person_id'...)`).
      Per-edit approval.
- [x] T004 [US2] Edit `src/modules/orders/api/orders.api.ts` — `createOrder` (:292): pre-insert
      job ensure per plan §P2. When `order.job_id` absent AND `order.person_id` present: query
      `jobs` for `.eq('organization_id', organizationId).eq('person_id', order.person_id)
      .is('exit_reason', null).limit(1)`; if none, insert job `{organization_id, person_id,
      source: 'manual', stage: 'enquired', stage_status: 'uncontacted'}` (mirrors
      addToPipeline.api.ts:117–128, inlined — no new cross-module import) and stamp its id into
      the order payload; if the job insert fails, log and proceed job-less (creation must never
      fail because of automation). If a job EXISTS → leave `job_id` null (OQ-C deferred).
      Sequential after T003 (same file). Per-edit approval; prediction states exact insertion
      point and match count.
- [x] T005 [P] Locate the `Order` type / `RawOrder` / `normalizeOrder` definition file (grep
      `function normalizeOrder` in `src/modules/orders/`), then add
      `archived_at: string | null` to the type(s). Different file from T003/T004 → [P] in
      principle; per-edit approval serializes in practice. Prediction: state file, insertion
      point, match count.
- [x] T006 [P] Edit `src/shared/types/database.types.ts` orders block (:2799 Row, :2866 Insert,
      Update): add `archived_at: string | null` / `archived_at?: string | null` ×2. Three
      edits, each with unique anchor (predict match counts; beware same-text-different-indent —
      grep -A the literal first per 19-Aug learning).
- [x] T007 VERIFY-ONLY (no edit): `src/modules/orders/hooks/useOrders.ts:218` onSuccess fires
      `autoAdvanceJobStage(…, 'quoted')` when `data.job_id` set — confirm unchanged and that
      T004's stamped job_id reaches it (createOrder returns the inserted row via
      `.select('*')`). Also `:257` for createOrderFromQuote. Report findings, no changes.
- [x] T008 VERIFY-ONLY (no edit): `linkConversationToOrder` still has zero callers (V1
      re-check at implement time); `inboxBuckets.ts` untouched (FR-013). Report only.

**Checkpoint T008-C — STOP and WAIT for Giorgi**: review the full frontend diff (per-edit
approvals already given individually; this is the whole-diff pass). Giorgi may run gates early
here (tsc=55, lint=10/16) to catch drift before migration authoring.

---

## Phase 3: Cutover migration authoring (US1 + US3, one file)

- [x] T009 [US1/US3] Author `supabase/migrations/20260820TTTTTT_quote_to_job_cutover.sql`
      (timestamp fixed at authoring time) with the full S0–S8 structure from plan.md §Migration
      design and data-model.md:
      - Evidence-header SKELETON (placeholders only — no fabricated numbers; FR-012).
      - S0 partition SELECT (23 persons: quote-order count, active-job count, latest quote
        enquiry id, stamped conversation ids). **Header notes the F1 hard requirement: S0
        output pasted BEFORE S3/S4 run.**
      - S1 `alter table public.orders add column archived_at timestamptz;` (DDL,
        tenant-neutral — stated in comment).
      - S2 `CREATE OR REPLACE public.create_quote` per contracts/create_quote.md: f683e4c
        person-upsert VERBATIM (org-scoped dedupe on both SELECTs), cemetery resolve
        unchanged, forward-dedupe job SELECT (`stage='enquired'`, `exit_reason is null`,
        org-guarded), job insert (`source 'website'`, `stage 'enquired'`, `stage_status
        'uncontacted'`), enquiry insert WITHOUT order_id, job attach UPDATE (enquiry_id +
        conversation_id via `external_thread_id = 'enquiry:'||v_enq_id`), legacy-key return
        (`order_id: null`, `edit_token` echo, + `job_id`). NO orders insert anywhere in body.
      - S3 ensure-insert jobs for Partition B (org guard + NOT EXISTS active job;
        `stage_status 'pending'`, `created_at` = enquiry's, RETURNING id, person_id) with
        dry-run SELECT comment above.
      - S4 attach UPDATE for Partition A (enquiry_id → latest quote enquiry, conversation_id
        coalesce; stage NOT touched; org guard; RETURNING) with dry-run comment.
      - S5 provenance `UPDATE orders SET job_id …` (org guard, `order_type='quote'`,
        `job_id IS NULL`; RETURNING; expected ≈10, exact from S0) with dry-run comment.
      - S6 archive `UPDATE orders SET archived_at = now() …` (org guard, `order_type='quote'`,
        `archived_at IS NULL`; RETURNING; expected 30) with dry-run comment.
      - S7 FR-008 `UPDATE inbox_conversations SET order_id = NULL …` (org guard, order_id IN
        org-guarded quote-order subselect; RETURNING; expected count from S0) with dry-run
        comment.
      - S8 read-back suite (23-person invariant; 0 unarchived / 0 job-less quote orders;
        0 stamped conversations org-wide; create_quote def + ACL service_role-only + no `\r`;
        Churchill counts unchanged).
      - Rollback map comment (quickstart §Rollback).
      Write as ONE new file; LF endings. Per-edit approval on the file.
- [x] T010 LF verification: `git ls-files --eol` on the new file shows `w/lf` (or normalize
      and re-verify). Report the actual output.

**Checkpoint T010-C — STOP and WAIT for Giorgi**: full migration file review. Nothing past
this line until Giorgi approves the SQL verbatim.

---

## Phase 4: Pre-apply protocol (Giorgi-driven)

- [x] T011 CHECKPOINT (closed 20 Aug — sent by Giorgi via WhatsApp) — Arin WARNING (not a permission request), cutover option (a) decided
      20 Aug: delivered via WhatsApp BEFORE Dashboard apply. Claude drafts the message;
      **Giorgi reviews the draft before sending — never sent unreviewed**. Exhibits: badge
      flip (23 people); "Edit Your Quote" 404s **including the F2-strengthened form — the
      portal keeps EMAILING fresh broken links until SearsMelvin changes their email
      template**; the V3 exhibit (portal edit-quote path corrupts product_config —
      quote-escaping bug, orders 251/252 — retiring a feature that damages data). Wednesday's
      call becomes a demo of the shipped state PLUS the F3 orders-page question as Arin's
      explicit choice (the 30 rows are the same uneditable-in-EditOrderDrawer orders). WAIT
      for send confirmation.
- [x] T012 CHECKPOINT (confirmed 20 Aug: e52d8fc committed+pushed before any Dashboard statement; amendments 9fcdfa9/08d628c/d15919c likewise pre-apply) — Giorgi commits + pushes (explicit paths, quickstart §1):
      `supabase/migrations/20260820TTTTTT_quote_to_job_cutover.sql`,
      `src/modules/orders/api/orders.api.ts`, `src/shared/types/database.types.ts`, the T005
      type file, and `specs/quote-to-job-pipeline/*`. Migration file is committed with
      evidence-header SKELETON BEFORE any Dashboard apply. WAIT.

---

## Phase 5: Dashboard apply (Giorgi runs every statement; Claude predicts, never runs)

Dashboard auto-commits per statement — ordering is the safety mechanism. For EACH DML: dry-run
SELECT first (output pasted), predicted count stated by Claude BEFORE Giorgi runs, actual
rows-affected + RETURNING pasted after. "Applied" ≠ "rows affected" — a 0-row UPDATE's
"Success" is a failure here. Any count surprise = STOP.

- [x] T013 (20 Aug: 23 persons, A=15/B=8, raw table in evidence header; F5 finding d4b7a8ac → S4c amendment authored + review PASSED) [US3] S0 partition SELECT — Giorgi runs; output pasted into the evidence header
      **NOW, before anything else runs** (F1 hard requirement). Expected: 23 persons; A/B
      split consistent with the 1-Aug backfill (research F1). CHECKPOINT if persons ≠ 23 or
      the split surprises. WAIT.
- [x] T014 (20 Aug: archived_at | timestamptz | YES) [US1/US3] S1 column add — read-back `information_schema.columns` shows
      `archived_at`. WAIT.
- [x] T015 (20 Aug: cr_pos=167 caught → server-side strip → re-read-back 0,0; ACL service_role-only) [US1] S2 create_quote replace — read-backs: `pg_get_functiondef` (contains no
      `insert into public.orders`, no `\r`), ACL service_role-only. From here the backfill
      window is race-free. WAIT.
- [x] T016 (20 Aug: dry-run 8 / applied 8) [US3] S3 ensure-insert (Partition B). Predicted 8 ✓.
- [x] T017 (20 Aug: dry-run 1 / applied 1 — guard skipped 14 already-latest jobs; S4c amendment dry-run 3 / applied 3, 'closed') [US3] S4 attach (Partition A) + S4c collapse.
- [x] T018 (20 Aug: dry-run 13 / applied 13 — matches revised ≈13 prediction) [US3] S5 provenance job_id stamp.
- [x] T019 (20 Aug: dry-run 30 / applied 30) [US3] S6 archive. Predicted 30 ✓.
- [x] T020 (20 Aug: dry-run 30 / applied 30 — matches S0 stamped total) [US3] S7 conversation stamp nulling.
- [x] T021 (20 Aug: a=23/0, b/c=0/0, d=0, e=0,0+service_role ACL, g=0; f WAIVED by Giorgi — all DML org-guarded to SM) [US3] S8 read-back suite — all outputs pasted: 23-person invariant; 0 unarchived /
      0 job-less quote orders; 0 stamped conversations org-wide; function def + ACL; Churchill
      jobs/orders/inbox_conversations counts UNCHANGED. CHECKPOINT on any deviation. WAIT.
- [x] T022 (20 Aug: c34e91c pushed; post-commit correction: S4c timestamp flag stripped as timezone-explained — rides the next commit) Evidence commit — Claude updates the migration file's evidence header with
      everything pasted (per-edit approval); Giorgi commits it (explicit path). WAIT.

---

## Phase 6: Live verification (staging build against prod data)

**T023–T026 run on the LOCAL dev build (which has the archived_at filter); the deployed
staging site shows pre-merge behavior until T028 — that is EXPECTED, not a failure.**

- [x] T023 (20 Aug GREEN both directions; found job-orders path gap — fetchOrdersByJobId filtered, decision a, commit 33bc109; re-check GREEN: d4b7 Enquiry badge, 4th job active + 3 exited in dropdown, empty order panel, no Create invoice) [US3] Inbox badge flip: the 23 people's conversations show "Enquiry"; a person
      with a REAL open order still shows "Existing order". (spec SC-003)
- [ ] T024 (DECISION 20 Aug: MERGE WITHOUT T024 — RPC proven by read-backs, Partition-B rendering proves the enquiry→job→conversation chain; the untested link is the live portal worker call, and the function is already live for the next quote regardless of merge. STAYS OPEN as a watch item: verify the next organic quote end-to-end when it lands, ~2/week) [US1] New-quote E2E: portal submit → person + job('enquired') + enquiry, NO orders
      row; conversation web-channel, linked, bucket 'enquiry'. Second submit from same person
      → SAME job re-used, enquiry_id repointed (FR-004). Submit from a person with an
      in-production job → NEW job. (spec SC-001; coordinate a real submission or wait for the
      next organic quote — ~2/week)
- [x] T025 (20 Aug GREEN; fixture person 8d9d8895-2638-4eff-9888-f428683f18b5 — S1: order + auto-job source 'manual' advanced to 'quoted', order.job_id set, console clean; S2: second order, zero new jobs, one card at 'quoted', job_id null. DB verification (20 Aug): order 258 f07dd0f5-0c81-444e-bf0e-f65e061ccc9b → job 022fcfc8-9c8d-4725-b973-1fb3e57afc9f (stage quoted, stage_status uncontacted, source manual); order 259 3ebefd79-48e1-4efa-8406-ec06520f1ad1 → job_id null, all job columns null. Fixture teardown DEFERRED to cleanup pass: ids tracked = person + 2 orders + 1 job) [US2] Grigorescu repro: create order for job-less person → job exists at 'quoted'
      (created 'enquired', auto-advanced); order for person WITH job → no duplicate job,
      order.job_id stays null. (spec SC-004)
- [x] T026 (20 Aug: 14-step click-path walk ALL GREEN. Notes: no bucket filter pills exist — classification verified via badges, checklist wording fixed; job cards don't render product details BY DESIGN — card click opens the correct conversation, verified on B-people, confirming S3 conversation_id links; enquiry config becomes material at order-creation, FR-010 pre-population UI is follow-on work — this cycle wired jobs.enquiry_id → enquiries.details) Regression checklist — walk EVERY row of plan.md §Regression checklist (isOrderOpen,
      classifier both paths, buildOrderById/buildPersonHasOpenOrdersSet inputs,
      UnifiedInboxPage:431 + :524 annotations, ConversationView enquiry render, inbox.api.ts
      message counts on a real order conversation, dead-export confirmation). Record outcomes
      per row.

**Checkpoint T026-C — STOP and WAIT for Giorgi**: verification results review. Any failure →
rollback map (quickstart §Rollback), not ad-hoc fixes.

---

## Phase 7: Gates + merge (Giorgi)

- [x] T027 CHECKPOINT (20 Aug: tsc=55, lint=10/16, deno trivially clean — no edge functions touched; T026-C approved) — Giorgi runs gates: `npx tsc --noEmit -p tsconfig.app.json` (pass = 55
      pre-existing, 0 new), `npm run lint` (pass = 10/16). Deno gate: no edge functions
      touched — state "trivially clean" in the PR. Claude predicts outcomes first. WAIT.
- [x] T028 CHECKPOINT (CLOSED 20 Aug: PR #17 merged to staging, merge commit 22fe539 — full branch history preserved, evidence ordering intact on trunk; deployed smoke check on staging.unifynow.digital GREEN: Kimberley Game "Enquiry", Ali Hazrati "Existing order". CYCLE COMPLETE. Standing watch items: T024 organic-quote E2E; fixture teardown 8d9d8895 / ORD-258+259 / job 022fcfc8 via Dashboard; Wednesday Arin agenda; backlog: .gitattributes sql eol, enum enforcement, FR-010 pre-population UI) — Giorgi opens PR `feature/quote-to-job-pipeline` → `staging` (trunk is
      staging). PR notes: spec+plan links; user-visible changes (badge flip; F2-strengthened
      broken-link emailing; F3 pending Arin); SearsMelvin revert risk
      (`2026-05-20-create-quote-rpc.sql`) + Wednesday mitigation; V3 product_config-corruption
      exhibit; enum-enforcement follow-up now unblocked; kerb-reactivation reference (251/252
      details show "Kerb Sets"). WAIT for merge.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 (strictly ordered) → Phase 6 → Phase 7.
- T003 blocks T004 (same file). T005, T006 are [P]-eligible with T003/T004 (different files)
  but per-edit approval serializes all edits in practice — parallel agent fan-out is NOT used
  in this cycle; checkpoint discipline is incompatible with it.
- T013 (S0 paste) HARD-blocks T016/T017 (F1 requirement).
- T015 (S2) intentionally precedes T016–T020: closes the quote-arrival race.
- Frontend filter (T003) must not DEPLOY before T014 (S1) — guaranteed by merge-last ordering
  (T028); note it in the PR.
- US-story independence caveat (template honesty): US1 and US3 are a single coordinated
  cutover by decision (spec) — they are NOT independently deployable. US2 (T004, T025) is
  independently deployable and testable at any point after T008-C.

## Out of scope — do NOT build (carried from spec/plan)

OQ-C person-wide job picker; FR-009 backward stage moves; order-type enum enforcement
(follow-up, now unblocked); jobs-fed inbox bucketing; dead-export cleanup
(`linkConversationToOrder`); orders-page archived-row filtering (F3 — Arin's Wednesday call);
`product_config` jsonb column migration.
