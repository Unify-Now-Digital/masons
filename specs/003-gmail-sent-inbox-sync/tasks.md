---
description: "Task list for 003-gmail-sent-inbox-sync (Gmail Sent sync)"
---

# Tasks: Gmail sent mail in unified inbox (003-gmail-sent-inbox-sync)

**Input**: `specs/003-gmail-sent-inbox-sync/` (`plan.md`, `spec.md`, `data-model.md`, `research.md`, `contracts/`, `quickstart.md`)  
**Tests**: Not requested in spec — manual verification via SQL + `quickstart.md` only.

**Ordering rules (strict)**:

1. **T001** — setup / scope review (no migration files).
2. **T002–T004** — database migrations only, **sequential** (each depends on the previous).
3. **T005** — verify DB state before any Edge Function work.
4. **T006–T008** — Gmail send-path inserts (do **not** modify `gmail-sync-now/index.ts`).
5. **T009+** — `gmail-sync-now/index.ts` **only after T005** is satisfied.

---

## Phase 1: Setup

**Purpose**: Confirm working tree and docs (no code changes).

- [x] T001 Review `specs/003-gmail-sent-inbox-sync/plan.md` and `spec.md`; ensure branch `003-gmail-sent-inbox-sync` is checked out.

**Title**: Align on scope and branch  
**Files**: _none_ (read-only)  
**Risk IDs**: _none_  
**Acceptance criteria**: Implementer has read plan risks R1–R15 and user stories US1–US3.  
**Blocked by**: none

---

## Phase 2: Foundational — database migrations (blocking)

**Purpose**: Backfills and index **must** deploy and be verified before **any** `gmail-sync-now` edit.

**Checkpoint**: T004 complete → Edge Function phase allowed.

### Migrations

- [x] T002 Migration: backfill `inbox_conversations.external_thread_id` from `inbox_messages.meta`

**Title**: Backfill conversation Gmail thread ids  
**Files**: `supabase/migrations/20260418120000_backfill_inbox_conversations_external_thread_id.sql`  
**Risk IDs**: R1, R2, R20  
**Acceptance criteria**: Email conversations with at least one Gmail message get non-null `external_thread_id` where `meta->'gmail'->>'threadId'` exists; only rows with `external_thread_id IS NULL` are updated; **use `DISTINCT ON (conversation_id) … ORDER BY conversation_id, created_at ASC`** in the subquery so the thread id comes from the **oldest** message (original thread), not an arbitrary row (`LIMIT 1` avoided — **R20**).

**Reference SQL** (must match migration file):

```sql
UPDATE public.inbox_conversations c
SET external_thread_id = subq.thread_id
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    meta->'gmail'->>'threadId' AS thread_id
  FROM public.inbox_messages
  WHERE channel = 'email'
    AND meta->'gmail'->>'threadId' IS NOT NULL
  ORDER BY conversation_id, created_at ASC
) subq
WHERE c.id = subq.conversation_id
  AND c.channel = 'email'
  AND c.external_thread_id IS NULL;
```

**Blocked by**: T001

---

- [x] T003 Migration: backfill `inbox_messages.external_message_id` from `meta.gmail.messageId`

**Title**: Backfill message Gmail ids into `external_message_id`  
**Files**: `supabase/migrations/<timestamp>_backfill_inbox_messages_external_message_id.sql` (new)  
**Risk IDs**: R3  
**Acceptance criteria**: Email rows with `meta->'gmail'->>'messageId'` set get `external_message_id` populated; rows without Gmail meta unchanged.  
**Blocked by**: T002

---

- [x] T004 Migration: unique partial index on `(gmail_connection_id, (meta->'gmail'->>'messageId'))` for `channel = 'email'`

**Title**: Enforce Gmail meta message id uniqueness (partial, email-only)  
**Files**: `supabase/migrations/<timestamp>_inbox_messages_unique_gmail_meta_message_id.sql` (new)  
**Risk IDs**: R4, R5, R6  
**Acceptance criteria**: `CREATE UNIQUE INDEX ... ON public.inbox_messages (gmail_connection_id, ((meta->'gmail'->>'messageId'))) WHERE channel = 'email' AND gmail_connection_id IS NOT NULL AND (meta->'gmail'->>'messageId') IS NOT NULL` (or equivalent), named consistently; migration **fails fast** if duplicates remain (resolve duplicates before apply — see T005 verification).  
**Blocked by**: T003

---

### Verification (gates Edge Functions)

- [x] T005 Run verification SQL against staging (or local DB after `supabase db reset` + apply migrations)

**Title**: Confirm backfills and no duplicate Gmail ids before Edge work  
**Files**: _none_ (SQL run in Supabase SQL editor); optionally append queries to `specs/003-gmail-sent-inbox-sync/quickstart.md`  
**Risk IDs**: R3, R15  
**Acceptance criteria**: (1) Sample `SELECT id, external_thread_id FROM inbox_conversations WHERE channel = 'email' LIMIT 50` shows expected non-nulls post-backfill. (2) `SELECT gmail_connection_id, meta->'gmail'->>'messageId', COUNT(*) FROM inbox_messages WHERE channel = 'email' AND (meta->'gmail'->>'messageId') IS NOT NULL GROUP BY 1,2 HAVING COUNT(*) > 1` returns **0 rows**. (3) Index from T004 exists in `pg_indexes`.  
**Blocked by**: T004

---

## Phase 3: User Story 1 — See Gmail web replies in the app thread (Priority: P1)

**Goal**: Sent-from-Gmail-web replies appear as outbound in the correct conversation; no duplicates.

**Independent Test**: Same as spec US1 — Gmail web reply in an existing thread → sync → one outbound row, re-sync idempotent.

### Gmail send paths — set `external_message_id` (no `gmail-sync-now` yet)

- [x] T006 [US1] Set `external_message_id` (and thread on conversation if missing) on Gmail send reply insert

**Title**: Record Gmail message id on send-reply inserts  
**Files**: `supabase/functions/gmail-send-reply/index.ts`  
**Risk IDs**: R12  
**Acceptance criteria**: `insert` into `inbox_messages` sets `external_message_id` to Gmail message id (same string as `meta.gmail.messageId`); conversation row gets `external_thread_id` when known from Gmail response if currently null.  
**Blocked by**: T005

---

- [x] T007 [US1] Set `external_message_id` on first-message send insert

**Title**: Record Gmail message id on first-message sends  
**Files**: `supabase/functions/gmail-send-first-message/index.ts`  
**Risk IDs**: R12  
**Acceptance criteria**: Same as T006 for this function’s `inbox_messages` insert.  
**Blocked by**: T005

---

- [x] T008 [US1] Set `external_message_id` on legacy Gmail send inserts

**Title**: Record Gmail message id on inbox Gmail send/new-thread inserts  
**Files**: `supabase/functions/inbox-gmail-send/index.ts`, `supabase/functions/inbox-gmail-new-thread/index.ts`  
**Risk IDs**: R12  
**Acceptance criteria**: Every `inbox_messages` insert for email sets `external_message_id` from Gmail API id; conversations created/updated get `external_thread_id` when returned by Gmail.  
**Blocked by**: T005

---

### `gmail-sync-now` — allowed only after T005

- [x] T009 [US1] Extract `syncLabel(labelId, directionHint)` helper

**Title**: Refactor listing + shared query window into `syncLabel`  
**Files**: `supabase/functions/gmail-sync-now/index.ts`  
**Risk IDs**: R7, R8  
**Acceptance criteria**: Shared logic for `messages.list` with `labelIds`, `maxResults`, `q` / `after:`, pagination, and `MAX_MESSAGES_LISTED_PER_SYNC` lives in one helper; existing INBOX behaviour preserved when called for `INBOX`.  
**Blocked by**: T005

---

- [x] T010 [US1] INBOX pass: set `external_thread_id` on conversation create/update

**Title**: Persist Gmail thread id on email conversations during INBOX ingest  
**Files**: `supabase/functions/gmail-sync-now/index.ts`  
**Risk IDs**: R8  
**Acceptance criteria**: When creating or updating a conversation from INBOX/thread ingest, `external_thread_id` is set to the Gmail `threadId` if null.  
**Blocked by**: T009

---

- [x] T011 [US1] All ingest inserts: set `external_message_id` + dedupe via pre-check or `ON CONFLICT`

**Title**: Populate `external_message_id` on sync inserts; dedupe against unique index  
**Files**: `supabase/functions/gmail-sync-now/index.ts`, `specs/003-gmail-sent-inbox-sync/quickstart.md` (note per below)  
**Risk IDs**: R11, R13, R22  

**Acceptance criteria**:

- **`external_message_id` is the single source of truth for dedupe** (lookups, `ON CONFLICT` targets, and application logic should prefer the column over raw JSON).
- **`ingestGmailMessage`** (or equivalent) **must** set **`external_message_id`** to the Gmail message id string (**same value as** `meta.gmail.messageId`) on **every** new insert, **inbound and outbound**.
- The **T004** unique partial index on the **JSON path** is a **bridge / safety net** only (enforces uniqueness at the DB when both paths are populated); **dedupe logic in T011 should not rely on JSON alone** once `external_message_id` is always set.
- **`meta.gmail` and `external_message_id` must always be set together** on insert — **never one without the other** (same Gmail id string in both places).
- Replace the in-memory “recent 1000” meta scan with a **targeted** query on **`gmail_connection_id` + `external_message_id`** (and/or **`ON CONFLICT`** on the appropriate unique constraint) where safe.
- **Documentation**: add a short **Gmail message identity** note to **`specs/003-gmail-sent-inbox-sync/quickstart.md`** stating the above (column SSOT, JSON index as bridge, meta + column in sync) — **R22**.

**Blocked by**: T010

---

- [x] T012 [US1] SENT pass: call `syncLabel` for `SENT`, match conversation, insert outbound, orphan skip

**Title**: List Sent, match by `external_thread_id`, insert or skip  
**Files**: `supabase/functions/gmail-sync-now/index.ts`  
**Risk IDs**: R7, R9, R10, R11, R26  

**Acceptance criteria**:

- Second call uses Gmail `SENT` label; for each candidate message, resolve `conversation_id` via `inbox_conversations.external_thread_id = <gmail threadId>` (scoped by user + org + connection as appropriate); insert **outbound** row when matched; **`console.warn`** and skip when no conversation (**orphan**).
- **`gmail_connections.last_synced_at` must advance only after both the INBOX pass and the SENT pass complete successfully** (same HTTP request). If the SENT pass throws, **catch** the error, log with **`console.error`**, and **do not** update `last_synced_at`. Return a response that indicates partial failure if appropriate (e.g. existing 502 pattern or a structured body — keep contract backward-compatible).
- **Rationale (R26)**: INBOX inserts are already **committed**; dedupe will **skip** those messages on the next sync run. Leaving `last_synced_at` unchanged preserves the **`after:` / incremental window** so the **next** sync **re-attempts SENT** for the same period.

**Implementation notes**:

- Move or guard the existing `last_synced_at` / `updated_at` update on `gmail_connections` so it runs **after** INBOX + SENT succeed, or only in a **finally** path that runs when SENT did not throw (do not advance on SENT failure).
- Do **not** roll back INBOX work in the DB (not practical across already-committed inserts); rely on **idempotent dedupe** + **cursor semantics** above.

**Blocked by**: T011

---

## Phase 4: User Story 2 — Thread preview stays truthful (Priority: P2)

**Goal**: Conversation list preview/time reflects latest activity including Sent imports.

**Independent Test**: Spec US2 — after Sent import, `last_message_at` / preview match latest outbound.

- [x] T013 [US2] Ensure conversation `last_message_at` / `last_message_preview` update for SENT outbound inserts

**Title**: Conversation summary updates when SENT message is newest  
**Files**: `supabase/functions/gmail-sync-now/index.ts` (reuse existing post-insert conversation update block; extend if SENT path bypasses it)  
**Risk IDs**: R8  
**Acceptance criteria**: When a SENT import is the latest message in the thread, conversation row gets updated preview/time; unread rules unchanged (outbound does not bump unread).  
**Blocked by**: T012

---

## Phase 5: User Story 3 — Operational safety (Priority: P3)

**Goal**: Sync remains bounded; dual-label listing does not break limits semantics.

- [x] T014 [US3] Reconcile global message cap across INBOX + SENT passes

**Title**: Document or adjust cap so two label passes stay within bounds  
**Files**: `supabase/functions/gmail-sync-now/index.ts`  
**Risk IDs**: R7  
**Acceptance criteria**: Total Gmail API list volume remains bounded (e.g. shared `MAX_MESSAGES_LISTED_PER_SYNC` across both passes, or documented split); no unbounded loops.  
**Blocked by**: T012

---

## Phase 6: Polish & cross-cutting

- [x] T015 [P] Lint and documentation touch-up

**Title**: Lint Edge Functions; align `quickstart.md` with verification SQL  
**Files**: `supabase/functions/gmail-sync-now/index.ts` (if needed), `supabase/functions/gmail-send-reply/index.ts`, …, `specs/003-gmail-sent-inbox-sync/quickstart.md`  
**Risk IDs**: _none_  
**Acceptance criteria**: `npm run lint` passes; `quickstart.md` lists T005 verification queries and end-to-end steps.  
**Blocked by**: T013

---

## Dependencies & execution order

### Linear chain (migrations + gate)

```text
T001 → T002 → T003 → T004 → T005 → (T006 ∥ T007 ∥ T008) → T009 → T010 → T011 → T012 → T013 → T014 → T015
```

**Note**: T006, T007, T008 are parallelizable **[P]** after T005 (different files).

### User story completion order

- **US1 (P1)**: T006–T012  
- **US2 (P2)**: T013 (depends on T012)  
- **US3 (P3)**: T014  
- **Polish**: T015

### Parallel opportunities

- After **T005**: T006, T007, T008 can run in parallel (separate files, no `gmail-sync-now`).

---

## Implementation strategy

### MVP (User Story 1)

1. Complete **Phase 2** (T002–T005) — migrations applied and verified on staging.  
2. Complete **T006–T008** so sends populate `external_message_id` before heavy sync traffic.  
3. Complete **T009–T012** — `gmail-sync-now` SENT + dedupe.  
4. Stop and run **quickstart** manual test.

### Suggested scope order

1. Foundational (T002–T005)  
2. Send-path fixes (T006–T008)  
3. Sync refactor (T009–T012)  
4. Preview + caps (T013–T014)  
5. Polish (T015)

---

## Format validation

- Every actionable task uses checklist format `- [ ] Tnnn ...` with **Task ID** and **file paths** in the title line.  
- **[USn]** labels only on User Story phase tasks (T006+).  
- **Blocked by** references only prior task IDs.  
- **Risk IDs** map primarily to `specs/003-gmail-sent-inbox-sync/plan.md` (R1–R15); extended IDs (e.g. **R20**, **R26**) are defined in task notes where listed.

**Total task count**: **15** (T001–T015)

| Phase | Task IDs | Count |
|-------|----------|-------|
| Setup | T001 | 1 |
| Foundational | T002–T005 | 4 |
| US1 | T006–T012 | 7 |
| US2 | T013 | 1 |
| US3 | T014 | 1 |
| Polish | T015 | 1 |

---

## Notes

- **T004 vs T011 / R22**: The JSON-path unique index is a **bridge**; **`external_message_id`** is the **SSOT** for dedupe in app code (**T011**). Prefer column-based lookups; **`meta.gmail` and `external_message_id` always together** on insert. A follow-up migration may add a partial unique on `(channel, gmail_connection_id, external_message_id)` and retire or narrow the JSON index when safe.  
- **No `gmail-sync-now` edits** until **T005** verification passes (ordering rule).  
- **R26** (`last_synced_at` vs partial SENT failure): specified under **T012** — cursor advances only after **both** passes succeed; SENT errors are **`console.error`** without advancing the cursor.
