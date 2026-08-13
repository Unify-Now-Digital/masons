# Data Model: Assisted Contact Creation + Backfill

**Date**: 14 Aug 2026. Schema changes are **additive only** (one CHECK constraint); everything
else is stamping existing columns.

## people (existing table — constraint added)

| Column | Type | This feature |
|---|---|---|
| `id` | uuid PK | — |
| `organization_id` | uuid | Always stamped by every writer (tenant scope) |
| `first_name` / `last_name` | text | Assisted: from the dialog form. Backfill: B3 fallback (email local-part / `''`) |
| `email` / `phone` | text null | Assisted: prefilled from handle. Backfill: normalized email handle |
| `created_via` | text null | **Vocabulary now enforced**: `'inbox_ingest'` \| `'inbox_assisted'` \| `'manual'` \| NULL (legacy) |
| `is_test` | boolean | `resolvePersonId` starts stamping `false` (FR-B2); attemptAutoLink already does |

### New constraint (FR-B1)

```sql
alter table people
  add constraint people_created_via_allowed
  check (created_via is null
         or created_via in ('inbox_ingest', 'inbox_assisted', 'manual'))
  not valid;

alter table people validate constraint people_created_via_allowed;
```

- `NOT VALID` + `VALIDATE` as two statements (Dashboard auto-commits per statement; validate
  takes only SHARE UPDATE EXCLUSIVE, so live traffic is unblocked during the scan).
- NULL stays legal → legacy rows and any conscious-NULL writer keep working; only invalid
  **non-NULL** values are rejected (spec edge case: deploy order cannot break in-flight writers).
- Precondition evidence at apply time: `select created_via, count(*) from people group by 1;`
  must show only `inbox_ingest` / NULL (plus any rows this feature already stamped).

### `created_via` writer matrix (target state)

| Writer | Value | Where stamped |
|---|---|---|
| `attemptAutoLink` (ingest + backfill) | `'inbox_ingest'` | `autoLinkConversation.ts` insert (already live) |
| `AddToCustomersDialog` (from a conversation) | `'inbox_assisted'` | call-site spread into `createCustomer` payload |
| `CreateCustomerDrawer` (People page) | `'manual'` | call-site spread |
| `QuickCreatePersonDialog` (invoicing) | `'manual'` | call-site spread |
| `resolvePersonId` (add-to-pipeline / sidebar S5) | `'manual'` | insert object in `addToPipeline.api.ts` |
| Anything the FR-B3 final audit surfaces | valid value or recorded conscious-NULL | audit task output |

## inbox_conversations (existing table — no schema change)

Relevant existing invariant (Commit A/B):

```sql
constraint inbox_conversations_link_state_person_consistent
  check ((link_state = 'linked') = (person_id is not null))
```

- Assisted create and backfill both end in writes that set `person_id` + `link_state='linked'`
  **atomically in one UPDATE** (frontend `linkConversations` / shared `updateLinkState`), so
  the CHECK is satisfied by construction.
- `link_state` values in play: `unlinked` (assisted + backfill subjects), `ambiguous`
  (assisted-only; **excluded** from backfill candidates), `linked` (target state).
- Mute state lives in `inbox_muted_senders` — untouched by every write path in this feature
  (spec edge case: creating/linking never unmutes).

## CustomerInsert (frontend type — `src/modules/customers/hooks/useCustomers.ts`)

```ts
export type CustomerInsert = Omit<Customer, "id" | "created_at" | "updated_at"> & {
  created_via?: "inbox_assisted" | "manual";
};
```

Optional so `CustomerUpdate = Partial<CustomerInsert>` never carries it into updates; the
insert path spreads it through unchanged. The DB CHECK is the enforcement; the narrow TS union
is the writer-side guardrail.

## Backfill run record (evidence artifact, not a table)

`specs/assisted-contact-creation-and-backfill/backfill-evidence.md`:
- Dry-run JSON: per-handle candidates `{ handle, conversation_ids[], gate_pass, existing_person_id? }`
  — the reviewed list (FR-C4 approval gate).
- Execute JSON: per-conversation outcomes `{ conversation_id, handle, outcome:
  created_and_linked | linked_existing | skipped_<reason> | error, person_id? }`.
- Read-back SELECTs: created-people count by `created_via`, linked-conversation count, and a
  zero-rows proof that no `channel='web'` or phone-handle conversation changed.
