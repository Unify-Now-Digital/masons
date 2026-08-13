# Research: Assisted Contact Creation + Backfill

**Date**: 14 Aug 2026 · **Branch**: `staging` (repo trunk convention) · **Working tree**: clean at f61ba12
All line numbers below re-verified against the working tree on 14 Aug 2026 — they are anchors,
not addresses; re-grep before editing.

## R1 — Plan-phase verification item: AddToCustomersDialog prefill + duplicate handling

**VERIFIED — behaves as the spec asserts**, with two recorded caveats.

`src/modules/inbox/components/AddToCustomersDialog.tsx`:

- **Prefill**: `useEffect` on `[open]` (:81–:95) resets the form with
  `email: prefill.email ?? ""`, `phone: prefill.phone ?? ""`. The sole current caller
  (`CustomerConversationView.tsx:274–:284`) passes
  `{ email: handle.toLowerCase().trim() }` for email channels, `{ phone: handle }` otherwise.
  Prefill is real and intentionally re-fires only on dialog (re)open.
- **Duplicate handling**: `findDuplicate` (:133–:143) checks normalized-email equality and
  last-10-digit phone equality (≥7 digits guard) against `useCustomersList()`. First submit with
  a match shows "This person may already exist" + **Link to this person instead** (:234–:249);
  the button label flips to **Create anyway** (:267–:269). Both paths end in `linkTo(...)`, so
  the link still completes (spec edge case satisfied).
- **Link-failure visibility**: `linkTo`'s `onError` (:119–:128) toasts
  "Person saved, but linking failed … Use \"Link person\" to finish linking." — the
  save-succeeds/link-fails edge case is already handled; no orphaned-contact silence.
- **Multi-conversation linking**: the dialog links **all** `conversationIds` it is given via
  `useLinkConversations` (bulk). FR-A3's "link ALL of the handle's unlinked conversations" is
  therefore a caller obligation (pass the full group's ids), not a dialog change.

**Caveats (recorded, accepted):**
1. `useCustomersList()` excludes `is_test` rows when Show-test-data is off
   (`useCustomers.ts:37,:86`), so a duplicate that is a test row can slip past `findDuplicate`.
   The org-scoped unique index (R6) still hard-stops same-org email duplicates at insert time.
2. Duplicate check runs client-side over the fetched list — races with a concurrent ingest
   create resolve at the DB unique index (23505 surfaces as the create-error toast), matching
   the spec's race edge case: constraint resolves to a single person.

## R2 — Change-link dead button: root cause confirmed on current tree (FR-D1)

`src/modules/inbox/components/CustomerConversationView.tsx` — the 13 Aug investigation's
circular gate is verbatim present:

1. Linked-branch candidate query enabled **only when the modal is open**:
   `useConversationsList(..., { enabled: !!linkedPersonId && linkModalOpen })` (:134–:137).
2. `bulkConversationIds` derives from that query (:158–:160); `canLink =
   bulkConversationIds.length > 0` (:164).
3. The primary action's onClick is gated `if (!canLink) return;` **before**
   `setLinkModalOpen(true)` (:334–:336).

For linked selections the query can never enable, so `canLink` is permanently false and the click is a
no-op. (Unlinked selections escape when the parent supplies `unlinkedGroupConversationIds`,
which bypasses the query — that is why only Change-link presents as dead.)

**Decision — minimal fix**: delete the `if (!canLink) return;` early-return. Clicking then sets
`linkModalOpen`, which enables the query; the modal's `open={linkModalOpen && canLink}` (:253)
opens it as soon as ids arrive. No query-enablement change, no new state.

**Accepted residual**: a linked person with zero **open** conversations (the query filters
`status: 'open'`) still yields a non-opening click. There is nothing to relink in that state;
recorded as accepted, not fixed.

## R3 — created_via stamping path for assisted create (FR-A2)

`Customer` is a **hand-written interface** (`useCustomers.ts:6–:17`) that omits `created_via`;
`CustomerInsert = Omit<Customer, "id"|"created_at"|"created_at">`-style (:19). The runtime
insert spreads the payload (`createCustomer`, :55–:64), so a `created_via` key passes through
to PostgREST untouched.

**Decision**: extend the type, stamp at the three UI entry points:
- `CustomerInsert` gains `created_via?: 'inbox_assisted' | 'manual'` (optional — `CustomerUpdate =
  Partial<CustomerInsert>` must not start sending it on updates; callers stamp explicitly).
- `AddToCustomersDialog` (inbox entry) → `'inbox_assisted'`.
- `CreateCustomerDrawer` (People page) and `QuickCreatePersonDialog` (invoicing) → `'manual'`.
- `toCustomerInsert` stays a pure form mapper; the stamp is a call-site spread
  (`{ ...toCustomerInsert(values), created_via: ... }`) so the entry-point dependence (FR-A2)
  is visible at each entry point.

`useCreateCustomer` caller audit (repo grep, 14 Aug): exactly three components —
`AddToCustomersDialog.tsx:64`, `CreateCustomerDrawer.tsx:33`, `QuickCreatePersonDialog.tsx:41`.

## R4 — Primary-action placement (FR-A4/FR-A5)

Current state:
- **Grouped view** (`CustomerConversationView.tsx:333–:339`): primary = `Link person` /
  `Change link`; **Add to Customers is already wired but demoted to secondary** (:338–:339),
  dialog at :273–:285.
- **Ungrouped view** (`ConversationView.tsx:318–:319`): primary = `Link person` / `Change link`;
  **no AddToCustomersDialog wiring at all**, and its `LinkConversationModal` (:292–:300) passes
  no `onCreateNew`.

**Decision**:
- CustomerConversationView, unlinked selections: swap — primary label `Add to Customers`
  (opens dialog), secondary `Link person` (opens link modal). Linked selections keep primary
  `Change link`, no secondary (unchanged spec scenario 5).
- ConversationView: add the dialog (prefill from `conversation.primary_handle` by channel,
  `conversationIds=[conversation.id]`); unlinked → primary `Add to Customers`, secondary
  `Link person`; linked → primary `Change link` as today. Also pass `onCreateNew` to its
  LinkConversationModal for parity.
- **Ambiguous link_state**: `ConversationView`'s `isUnlinked` already treats
  `link_state !== 'linked'` as unlinked (:255). Decision: ambiguous threads get the same
  primary assisted-create action — the dialog's duplicate surface (R1) catches the
  candidate-person case, and `Link person` stays one click away as secondary.
- **Muted threads (FR-A5)**: mute/Hidden filtering only changes list placement; both views
  render the same header/actions for muted selections, and `linkConversations` touches only
  `person_id`/`link_state`/`link_meta` — no mute-state write anywhere in the path. Requirement
  is met by not regressing; verified at task time by the muted-thread test.

## R5 — Backfill mechanism (OQ-2 RULED 14 Aug: edge function, 2-phase)

Giorgi's ruling: one-off edge function `backfill-sm-contacts`, spec'd in
`contracts/backfill-sm-contacts.md`. Key design decisions:

- **Gate reuse (AC-005)**: the function imports `shouldAutoCreatePerson` for the dry-run
  report and calls the live **`attemptAutoLink`** with
  `{ createIfMissing: true, mutedSet }` for execution — creation, linking, race safety
  (23505 → re-query → link), and the FR-1 CHECK compliance are all the deployed ingest code
  path, zero reimplementation.
- **Candidate predicate**: org = SM; `person_id is null`; `link_state = 'unlinked'`
  (**ambiguous excluded** — candidates exist, creating would duplicate); handle contains `@`
  (email-shaped, FR-C1); `channel != 'web'` (GHL stubs excluded regardless of handle shape,
  FR-C2). Phone exclusion falls out of the email-shape filter.
- **Multi-conversation handles**: execute serially, ordered by handle — first conversation
  creates + links; subsequent same-handle conversations hit the 1-match path and link to the
  same person. One person per handle with no dedup pass needed.
- **Write-time re-check**: `attemptAutoLink` re-selects the conversation and no-ops if
  `person_id` is set (`autoLinkConversation.ts:57–:65`) — the review→execute manual-link race
  in the spec's edge cases is covered natively.
- **Idempotency (FR-C4/AC)**: re-run → linked conversations no-op; existing person matches →
  link-only. Safe to re-invoke.
- **Provenance**: backfill-created rows carry `created_via='inbox_ingest'` (same code path;
  FR-B1's vocabulary has no separate backfill value — recorded as a conscious decision).
- **Naming**: conversations carry no counterparty display name, so B3's fallback applies
  (email local-part as first_name, `last_name: ''`).
- **Auth/guardrails**: JWT verification **enabled** (plain deploy — no `--no-verify-jwt`);
  invoked by Giorgi with the service-role key as Bearer. Body must name the org id explicitly;
  the function refuses a missing/mismatched org. `mode: 'dry-run'` (default) writes nothing and
  returns the reviewable candidate list; `mode: 'execute'` requires Giorgi's explicit go after
  reviewing the dry-run output (the approval gate demanded by the SM live-data guardrail).
- **Evidence**: dry-run + execute JSON responses and read-back SELECTs are pasted into
  `specs/assisted-contact-creation-and-backfill/backfill-evidence.md`; the function is deleted
  after evidence is recorded (`supabase functions delete backfill-sm-contacts`).

## R6 — FR-B3 people-writer audit (preliminary; final audit is a task)

Repo-wide grep (`from('people')` + insert/upsert, multiline, 14 Aug) — **exactly three insert
sites**, no upserts:

| Writer | Site | Stamps today | Target state |
|---|---|---|---|
| `attemptAutoLink` | `supabase/functions/_shared/autoLinkConversation.ts:199–:212` | `created_via:'inbox_ingest'`, `is_test:false` | unchanged |
| `createCustomer` (3 UI entry points, R3) | `src/modules/customers/hooks/useCustomers.ts:55–:64` | nothing | entry-point stamp (R3) + `is_test:false`? — **No**: `is_test` defaults false at the DB; UI creates are real contacts. Stamp `created_via` only. |
| `resolvePersonId` | `src/modules/jobsPipeline/api/addToPipeline.api.ts:68–:79` | nothing | `created_via:'manual'`, `is_test:false` (FR-B2) |

The spec's "SM website enquiry path" resolves to GHL webhook → `ghlConversationSync` →
`attemptAutoLink` (flipped in T025) — it is the first row, not a fourth writer. The final
audit task re-sweeps with broader patterns (`insert into people` in SQL functions/triggers,
`rpc(`, migrations) before the CHECK constraint is applied; historical backfill migrations are
apply-once records, not live writers, and are recorded as such.

## R7 — CHECK constraint shape and deploy order (FR-B1)

- Live column: `people.created_via text`, no constraint
  (`supabase/migrations/20260810_people_created_via.sql` — comment explicitly defers the CHECK
  to this feature). Distinct live values expected: `'inbox_ingest'` and NULL; the migration's
  precondition query (`select distinct created_via from people`) proves it at apply time.
- Constraint: `check (created_via is null or created_via in
  ('inbox_ingest','inbox_assisted','manual'))`, added `not valid` then
  `validate constraint` (two statements — Dashboard auto-commits per statement, and NOT
  VALID+VALIDATE avoids a long ACCESS EXCLUSIVE validate on a live table).
- **Deploy order is safe in any order** because NULL remains allowed: unstamped writers write
  NULL, never an invalid non-NULL. Convention order anyway: frontend stamping (R3) + FR-B2 land
  first, then the migration.

## R8 — Stale comment + adjacent stale toast (FR-E1)

- `PersonOrdersPanel.tsx:128–:130` claims a "GLOBAL people_email_key unique index …
  pending the (organization_id, lower(email)) index migration". Stale: that migration landed —
  `20260802220000_people_org_scoped_email_unique.sql` created `people_org_email_key` and
  dropped `people_email_key` (the migration's own follow-ups list flags this very comment/toast
  as stale). A 23505 there now means a **same-org** duplicate.
- **Adjacent finding**: the user-facing toast right below (:133–:141) says "exists in another
  organization — known limitation pending a database fix" — now false for the org-scoped index.
  FR-E1 covers the comment; rewording the toast is flagged as an explicit small task for the
  same edit (user-visible falsehood, one string).

## Open questions — RULED (Giorgi, 14 Aug 2026, via plan-phase Q&A)

- **OQ-1**: pending-review marker on the People page → **deferred to a later commit**.
  `created_via` provenance is the record; no UI marker in Commit C.
- **OQ-2**: backfill vehicle → **edge function, 2-phase dry-run/execute** (R5).
