# Quickstart: verifying Assisted Contact Creation + Backfill

Manual verification walkthrough, ordered by user story. All SM writes follow the live-org
guardrails: disposable fixture pattern (per the approved T029–T031 protocol), diffs/read-backs
shown at every step, Giorgi runs all deploys and SQL.

## Gates (every commit)

```bash
npx tsc --noEmit -p tsconfig.app.json   # exactly 55 pre-existing errors, 0 new
npm run lint                            # baseline 10 errors / 16 warnings, nothing new
# deno check on backfill-sm-contacts entrypoint + touched _shared graphs (zero-baseline;
# proof-send untouched this feature — if checked anyway, verbatim 4-error baseline)
```

## US1 — Assisted create-from-thread (P1)

1. In the inbox (Customers tab, grouped view), select an **unlinked** email thread → the
   visible primary action reads **Add to Customers** (secondary: Link person).
2. Click it → dialog opens with the email prefilled (lowercased). Fill names, save.
3. Read back (org-scoped):
   `select id, created_via, is_test from people where email = '<handle>';` →
   `created_via='inbox_assisted'`.
   `select id, person_id, link_state from inbox_conversations where organization_id='<org>'
   and lower(primary_handle)='<handle>';` → every row of the handle's group linked.
4. Repeat from the **ungrouped** view (All/other tab) on a phone-handle thread → phone
   prefilled; same stamp-and-link result for that conversation.
5. Muted thread: Hidden filter → select a muted unlinked thread → primary action present and
   working; after save, `inbox_muted_senders` row unchanged (still muted).
6. Linked thread: primary action is **Change link**, no Add-to-Customers primary.
7. Duplicate path: assisted-create a handle whose person already exists → dialog surfaces
   "may already exist" → **Link to this person instead** links without creating.

## US3 — Change-link (P3) — verify before US2 so it can correct backfill mistakes

1. Open a **linked** conversation in CustomerConversationView, click **Change link**.
2. Modal opens on first click; candidate people load; pick another person → relink completes,
   header updates. (Before the fix this click was a silent no-op.)

## US4 — Provenance integrity (P4)

1. People page → create a person → `created_via='manual'`.
2. Invoicing quick-create → `'manual'`. Add-to-pipeline on a conversation with no person →
   `resolvePersonId` row has `created_via='manual'`, `is_test=false`.
3. Migration applied (Dashboard): precondition `select created_via, count(*) from people
   group by 1;` output pasted into the migration file; then
   `insert … created_via='bogus'` → **rejected** (23514); NULL insert → passes;
   `select convalidated from pg_constraint where conname='people_created_via_allowed';` → true.

## US2 — SM backfill (P2, after US1 is live)

1. Deploy: `supabase functions deploy backfill-sm-contacts` (JWT verification stays ON — no
   `--no-verify-jwt`).
2. Dry-run: POST with `{ "organization_id": "<SM>", "mode": "dry-run" }` (service-role
   Bearer). Review the candidate list (~30 expected; indicative, not a contract). **Stop for
   Giorgi's explicit go.**
3. Execute: same body with `"mode": "execute"`. Capture the per-row results JSON.
4. Read-backs (paste into `backfill-evidence.md`):
   ```sql
   select created_via, count(*) from people where organization_id='<SM>' group by 1;
   select count(*) from inbox_conversations
     where organization_id='<SM>' and link_state='unlinked' and primary_handle like '%@%'
       and channel <> 'web';                 -- residue = gate-fail handles only
   select count(*) from inbox_conversations  -- must equal its pre-backfill value
     where organization_id='<SM>' and channel='web' and person_id is not null;
   ```
   Plus: zero phone-handle conversations gained a person_id (compare pre/post counts).
5. Idempotency: re-POST execute → `people_created: 0`, all rows `skipped_already_linked`.
6. Cleanup: `supabase functions delete backfill-sm-contacts`; evidence file committed.

## SC cross-check

- SC-001 ↔ US1 steps 1–5 · SC-002 ↔ US4 · SC-003 ↔ US2 step 4 · SC-004 ↔ US3 ·
  SC-005 ↔ US1 step 7 + US2 step 5.
