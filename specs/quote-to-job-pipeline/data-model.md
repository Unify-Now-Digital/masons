# Data model: quote-to-job-pipeline

Schema deltas are ADDITIVE only. All DML org-guarded to SM
`3770972d-1bbd-417b-b413-297e844db285` (FR-011). Churchill: zero portal quotes, zero writes.

## Schema changes

### orders — new column (the archive mechanism this cycle defines; see research V2)

```text
archived_at  timestamptz  null   -- non-null = archived; additive, no default, no backfill
                                 -- outside the 30 SM quote orders
```

- No CHECK, no index this cycle (30 rows; partial index `where archived_at is not null` is a
  follow-up if archive grows).
- DDL is tenant-neutral (org guard applies to DML statements; a column add cannot be
  org-scoped) — stated explicitly per FR-011's intent.

### No other schema changes

- `jobs`, `enquiries`, `inbox_conversations`, `quote_access_tokens`: no DDL.
- `capture_quote_access_token` trigger, `create_inbox_from_enquiry`, `trg_sync_enquiry_to_inbox`:
  untouched (FR-005/FR-006).

## Entity states & transitions

### Job (pipeline work item)

- Created by: (a) new `create_quote` at `stage 'enquired'`, `source 'website'`,
  `stage_status 'uncontacted'`; (b) P2 auto-create in `createOrder` at `stage 'enquired'`,
  `source 'manual'`, `stage_status 'uncontacted'` (then auto-advanced to 'quoted' by the
  existing onSuccess hook); (c) backfill ensure-insert for job-less persons.
- Config linkage: `jobs.enquiry_id → enquiries.details` (jsonb). "Update config to latest"
  (FR-004) = repoint `enquiry_id` at the newest enquiry. Jobs hold no config columns.
- Conversation linkage: `jobs.conversation_id` stamped post-enquiry-insert via
  `inbox_conversations.external_thread_id = 'enquiry:' || enquiry_id` (synchronous trigger
  guarantees existence). Person linkage is the anchor (decided); conversation stamp is
  best-effort parity with the 1-Aug backfill.
- Active predicate: `exit_reason is null` (constraint `jobs_exit_pairs` couples it with
  `exited_at`).

### Order (order_type='quote') — terminal state

- Post-backfill: `archived_at = now()`, `job_id` stamped (provenance to the person's job),
  row otherwise untouched (`edit_token` already null via capture trigger; `product_config`
  preserved as the historical quote record per "archive-don't-drop").
- No NEW rows in this state ever again (rewritten `create_quote` inserts no orders).

### Enquiry

- Post-cutover inserts: `order_id` omitted (null); `person_id` from upsert (NOT NULL satisfied
  by ordering); `details = product jsonb` (unchanged behavior).
- Existing 30 quote enquiries: untouched rows; the latest per person becomes the job's
  `enquiry_id` target.

### Inbox conversation

- The 23 persons' quote conversations: `order_id → null` (FR-008). `person_id`/`link_state`
  untouched — they remain 'linked' via person.
- Bucket outcome: 'enquiry' (both classifier order-paths go quiet: null stamp kills
  `linkedOrder`; archived_at fetch filter kills `personHasOpenOrders`).

## Read-path changes (frontend)

- `fetchOrdersByPersonIds` (orders.api.ts:194) and `fetchOrdersByPersonId` (orders.api.ts:169):
  add `.is('archived_at', null)`. These two feed ALL inbox bucketing (UnifiedInboxPage:396,
  ConversationView:82).
- `Order` type + `normalizeOrder` + hand-maintained `database.types.ts` orders block: add
  `archived_at: string | null`.
- DECISION CHECKPOINT (Giorgi): whether the main orders list / map / finance fetches also
  exclude archived orders this cycle (30 rows would vanish from the orders page — a second
  user-visible change for the Arin agenda) or in the enum-enforcement follow-up. Plan
  recommends: bucketing-only this cycle (minimal blast radius; orders-page visibility is
  status quo), revisit at follow-up.

## Backfill set arithmetic (verified 20 Aug + F1 correction)

- 30 SM `order_type='quote'` orders, 23 distinct `orders.person_id` (populated on all 30,
  matches `enquiries.person_id` on all 30).
- F1 (research): the 1-Aug backfill already created jobs for all then-existing quote enquiries
  ('quoted' stage, `orders.job_id` stamped on 20). The backfill is therefore
  **ensure-one-active-job-per-person**, not insert-23:
  - Partition A — person has an active job (`exit_reason is null`): repoint `enquiry_id` to
    their latest quote enquiry; leave stage alone.
  - Partition B — person has no active job: insert job (`source 'website'`,
    `stage 'enquired'`, `stage_status 'pending'` — matching the 1-Aug backfill's convention
    for backfilled rows), `enquiry_id` = latest quote enquiry, `conversation_id` via
    external_thread_id join, `created_at` = enquiry's created_at.
  - Exact A/B membership comes from the apply-time partition SELECT (dry-run recorded in the
    migration evidence block), not from this file.
- End-state invariant (SC-002 as corrected): each of the 23 persons has ≥1 active job whose
  `enquiry_id` is their latest quote enquiry; all 30 orders have `archived_at` non-null and
  `job_id` non-null; 0 conversations org-wide retain an `order_id` pointing at an archived
  quote order.
