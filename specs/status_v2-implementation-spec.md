# status_v2 / Jobs Pipeline — Implementation Spec (v2, 01 Aug 2026 22:00)

**Status: §2 schema APPLIED ✅ · §3.1–3.2 backfill APPLIED ✅ · §3.3 pending Arin (Mon) · §4 Add-to-pipeline BUILT ✅ (02 Aug, feature branch; revised: repeatable "New job" per person) · §5 Before-Paid page + exits BUILT ✅ · remaining: §4 website-trigger job insert (DB), §4 sidebar order/invoice job_id wiring, §5 After-Paid tab, §5 Orders quote filter**
**Product sign-off: Arin, 30 Jul (WhatsApp). Migration records: `20260801210000_jobs_pipeline_schema.sql`, `20260801213000_jobs_backfill_sm.sql` (both pushed to staging).**

## 0. Ground truth (all verified 01 Aug)

- 31 orders in SM: 20 × `order_type='quote'` (website portal writes), 11 × `'New Memorial'`. All status `'pending'` — old status column carries no information.
- 48 `enquiries` total: 43 SM, 5 Churchill (excluded from backfill; Churchill intake later).
- Website portal (`customer-order.js`) is unused: 0 `portal_token`s, ~0 post-creation edits. Quote emails still contain edit links → `create_quote` stays untouched this sprint.
- `trg_sync_enquiry_to_inbox` (AFTER INSERT on `enquiries`) creates conversation + first message. Kept.
- `inbox_conversations.enquiry_stage`: vestigial (default-only, writer has zero callers). Retire by non-reference; drop later.
- `src/modules/inquiries/`: read-only kanban over `enquiries` via `get_inquiries_pipeline` + `enquiry_scores`. Replaced by Pipeline page; files deleted post-cutover.
- Email/WhatsApp/GHL conversations: universally `person_id = null, link_state='unlinked'`. Web-channel: linked by trigger. → Add-to-pipeline must create persons.
- External constraint: SearsMelvin website reads `orders` columns directly (`stage`, `status`, `order_type`, `edit_token`, `tracking_token`, `inscription_*`, `proof_*`, `product_config`). Never rename/drop/repurpose these. Jobs design is purely additive.
- `create_quote` dedupes people by GLOBAL email → must be rewritten together with the future `people_email_key` org-scope migration (also `submit.js` upsertPerson fallback). Dependency logged, not this sprint.

## 1. Decision log

| # | Decision | Ruling |
|---|---|---|
| D1 | Pipeline entity | `jobs` table. One job per enquiry; job holds ≥1 orders; one invoice covers the job. Stage lives on jobs only. |
| D2 | Inbox intake | Manual "Add to pipeline" button. No auto-create from inbound messages. |
| D3 | Exits | lost / closed / dormant (wake date required) pre-paid; on_hold / cancelled post-paid; complete = terminal success stage. No hard delete; Exited view. |
| D4 | Invoiced gate | Move to Invoiced only when an invoice with this job_id exists (app-level, V1). |
| D5 | Website quote-orders | Reinterpret, don't kill: `create_quote` unchanged; `order_type='quote'` rows filtered out of Orders views/KPIs; backfilled as jobs at Quoted. **Pending 30-sec Arin confirm Monday.** |
| D6 | enquiry_stage | Retire by non-reference; column drop in later cleanup. |
| D7 | Inquiries page | Pipeline page takes route + sidebar slot; RPC + scores view retired at cutover. |

## 2. Schema — APPLIED 01 Aug via Dashboard ✅

As recorded in `20260801210000_jobs_pipeline_schema.sql`:
- `public.jobs` created (stage enum enquired→complete, stage_status, paid_at, exit_reason/exited_at/wake_at with dormant-needs-wake and exit-pairs constraints). Read-back: `to_regclass = 'jobs'`.
- RLS enabled at creation; policies `jobs_org_select/insert/update` mirroring `orders_org_*` (`user_is_member_of_org(organization_id)`). **No DELETE policy by design.** Read-back: 3 policies.
- Indexes `jobs_org_stage_idx` (active), `jobs_org_exited_idx` (exited). Read-back: 3 incl. pkey.
- Trigger `trg_jobs_updated_at` reusing `enquiries_set_updated_at`. (Caveat: functiondef never inspected; first suspect if job updates misbehave.)
- `orders.job_id`, `invoices.job_id` (nullable FK) + partial indexes. Read-back: both columns present.

## 3. Backfill

**3.1 APPLIED ✅** — 43 jobs inserted (23 enquired / 20 quoted), every job with person + conversation. Churchill's 5 excluded.
**3.2 APPLIED ✅** — 20 quote-orders linked; read-back 0 unlinked quote-orders.
**3.3 PENDING — Arin worksheet (Monday, ~3 min):** 11 non-quote orders:
- Orders 197, 198, 201, 207, 210, 211, 212 = test junk ("test", "tbc", "deceased name"…) → propose NO jobs; archive in separate cleanup with Arin's nod.
- Orders 218 + 219 = duplicate pair, Ayomide (Foluke) Osejindu — the Faith drawer-workaround duplicate from the handoff. Arin picks canonical → job at Invoiced; twin exited/archived; invoice patch (#4) points at survivor.
- Order 225 Amparo Valero Campbell = Maria Campbell's job → Confirmed, `paid_at` 30 Jul. (Note: `customer_name` holds the deceased/memorial subject, not the payer — Part B smell, logged.)
- Order 226 Patricia Fay Mullings → ask Arin; possibly Dean's (created the day he said "Dean hasn't paid, so invoiced") → Invoiced if so.
Then: insert jobs with assigned stages via explicit UUID list + set `orders.job_id`.

## 4. Intake wiring (app + DB, remaining)

- **Website:** no website-repo changes. Extend `trg_sync_enquiry_to_inbox` function (Dashboard, append-only migration record) to also insert a job (source 'website', stage per order_id rule, links set, idempotency guard on enquiry_id). *Not yet applied.*
- **Add to pipeline (inbox):** button on conversations without a job. If `person_id` null → create person from handle (org-scoped email/phone duplicate check — NEVER global) → create job (source=channel, stage 'enquired', stage_status 'uncontacted') → set conversation `person_id` + `link_state='linked'`. Note: conversation updates must NOT include `updated_at` in the payload (PostgREST silent-reject).
- **Order/invoice from conversation (sidebar):** orders created get `job_id`; invoice gets `job_id` + `person_id` + order linkage — this is also the #3 invoice-write-path fix. Can slip to Tue–Wed if Monday is tight; say so on the call.

## 5. Pipeline page (UI, remaining)

- Route: replace `/dashboard/inquiries`; sidebar label "Pipeline". Old inquiries module stays in tree until cutover verified.
- Before Paid tab: Enquired / Quoted / Invoiced columns from `jobs where exit_reason is null and paid_at is null`, org-scoped. Card: person name (fallback conversation `primary_handle`), stage_status pill, created date; invoice total on Invoiced cards when present. Click → its conversation in Inbox.
- Moves: forward/back free pre-paid; Invoiced move disabled unless invoice with `job_id` exists (D4).
- Exit: modal Lost / Closed / Dormant (+required wake date) → writes exit fields. Exited view = filterable list, no delete. *(First scope cut if time runs out: keep modal, defer list view.)*
- After Paid tab: read-only stage labels for post-paid jobs (populated after §3.3). Interactive gates post-sprint.
- Orders page + KPIs: filter `order_type <> 'quote'` (visible half of D5).
- Types: extend/regenerate `database.types.ts` for `jobs` + `job_id` columns first — everything depends on it.

## 6. Not in this sprint (logged)

enquiry_stage drop · inquiries module deletion (post-soak) · legacy `src/modules/jobs` + logistics `.from('jobs')` queries expect the old scheduling shape and break against the new table (pre-existing, hidden routes — retire or rebuild) · `people_email_key` org-scope + `create_quote` + `submit.js` rewrite (ship together) · portal rebuild · message-body ingestion · Part B (order_parties, grave, companies, payments ledger) · test-order archival (Arin nod) · customer-flag leftovers: Barnett + Lindsey (need person rows), Cawley + Hazrati (await orders), Lindsay bank-transfer payment recording · Churchill enquiry intake + GHL merge.

## 7. Gates

Dashboard: SELECT-first → statement → read-back, counts recorded in migration files. tsc `-p tsconfig.app.json`, 59-error baseline, zero new. `vite build` doesn't typecheck — run tsc separately. Claude Code claims → grep-on-disk verify; clean `git status` before push; explicit `git add <path>`. Commit + push before any edge deploy. One concern per commit, Giorgi's words.

## 8. Monday call agenda (Arin, ~5 min)

1. Demo: Pipeline page Before-Paid + Add-to-pipeline.
2. Confirm D5 (quotes → pipeline + filtered from Orders, instead of "kill").
3. Worksheet: place orders 218/219 (pick canonical), 225 (confirm paid), 226 (whose?); nod the 7 test orders for archival.
4. Honest scope status: sidebar order/invoice flow Tue–Wed if not demoed.