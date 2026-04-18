# Implementation Plan: Gmail sent mail in unified inbox

**Branch**: `003-gmail-sent-inbox-sync` | **Date**: 2026-04-18 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-gmail-sent-inbox-sync/spec.md`  
**DB findings (overrides spec assumptions)**: `inbox_conversations.external_thread_id` exists but is **NULL** for all email rows; **`inbox_conversations` has no `meta` column**; `inbox_messages.external_message_id` is **NULL** for all rows; confirmed JSON paths `meta.gmail.threadId` and `meta.gmail.messageId`; **no effective unique dedupe index** on Gmail ids in production introspection.

**Note**: This file is the `/speckit.plan` output. See `.specify/templates/plan-template.md` for workflow.

## Summary

Import Gmail **Sent** messages into the unified inbox as **outbound** rows, matched to conversations by **Gmail thread id**. Today sync only **lists INBOX**, so web-sent replies never enter the processing pipeline. Production data requires **backfilling `inbox_conversations.external_thread_id`** from existing `inbox_messages.meta` (and **backfilling `inbox_messages.external_message_id`**) before thread matching and dedupe can rely on columns. **Deploy order**: database migration and backfills **first**, then Edge Function changes.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite React app); Deno (Supabase Edge Functions)  
**Primary Dependencies**: `@supabase/supabase-js`, Gmail REST API (`gmail.googleapis.com`), Google OAuth refresh-token flow  
**Storage**: PostgreSQL (Supabase) — `inbox_conversations`, `inbox_messages`, `gmail_connections`  
**Testing**: `npm test`; `npm run lint`; manual Gmail + sync verification  
**Target Platform**: Web app + hosted Edge Functions  
**Project Type**: Web application (React SPA + Supabase backend)  
**Performance Goals**: Single sync run remains bounded (existing caps, e.g. max messages listed per sync); avoid doubling API calls without need  
**Constraints**: RLS on tenant/user data; OAuth tokens and service role only on server; migration must be safe on large tables (batched or indexed updates where needed)  
**Scale/Scope**: Small business mailboxes; additive schema + localized changes to `gmail-sync-now` and related Gmail send functions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|--------|
| Dual router (`src/app/` + `src/pages/`) | **Pass** | No routing change required for MVP |
| Module boundaries | **Pass** | Primary work in `supabase/functions/gmail-sync-now/` and migrations; optional small follow-ups in `src/modules/inbox/api` only if response shape changes |
| Supabase + RLS | **Pass** | Edge Function uses service role as today; no new tables; backfill runs as migration (trusted) |
| Secrets server-side | **Pass** | Gmail calls remain in Edge Functions |
| Additive-first | **Pass** | Additive columns already exist; backfills + indexes; avoid destructive drops without replacement |

**Post-design re-check**: Still **Pass** — contracts document existing JWT-authenticated POST; no new public surface on the frontend required.

## Project Structure

### Documentation (this feature)

```text
specs/003-gmail-sent-inbox-sync/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
└── tasks.md             # /speckit.tasks (not created here)
```

### Source Code (repository root)

```text
supabase/
├── functions/
│   ├── gmail-sync-now/index.ts       # Primary refactor: INBOX + SENT
│   ├── gmail-send-reply/index.ts     # Set external_message_id on insert
│   ├── gmail-send-first-message/index.ts
│   ├── _shared/gmailBody.ts          # Unchanged behaviour (reuse)
│   └── ...
├── migrations/                       # New: backfill + indexes

src/modules/inbox/
├── api/inboxGmail.api.ts             # Calls gmail-sync-now (unchanged contract if response stable)
└── types/inbox.types.ts
```

**Structure Decision**: Single Vite + React app under `src/` with feature modules; backend logic for Gmail in `supabase/functions/`. This feature is **backend-heavy** (sync + migrations).

## Complexity Tracking

No constitution violations requiring justification.

---

## Phase 0: Research

See [research.md](./research.md). All items resolved: thread matching via `external_thread_id`, dedupe via `external_message_id` + unique index, SENT import strategy (match after backfill; orphans skipped per product call).

## Phase 1: Design artifacts

| Artifact | Purpose |
|----------|---------|
| [data-model.md](./data-model.md) | Columns, backfill rules, matching rules |
| [contracts/](./contracts/) | `gmail-sync-now` request/response contract |
| [quickstart.md](./quickstart.md) | Manual verification steps |

---

## Implementation task breakdown

Tasks are ordered **by dependency**. Each includes **risk flags**.

### A. Database migrations (must deploy before Edge Function)

| ID | Task | Risk |
|----|------|------|
| **M1** | Backfill `inbox_conversations.external_thread_id` for `channel = 'email'` from subquery on `inbox_messages.meta->'gmail'->>'threadId'` (one thread id per conversation; handle NULL meta safely). | **R1** Wrong thread if multiple Gmail thread ids ever existed per conversation (data corruption edge case). **R2** Large table: long lock if not batched — consider chunked UPDATE or off-peak run. |
| **M2** | Backfill `inbox_messages.external_message_id` for email rows from `meta->'gmail'->>'messageId'` where NULL. | **R3** Duplicate Gmail ids in DB would violate later UNIQUE — run duplicate detection query first; merge or delete duplicates in a separate one-off or migration step. |
| **M3** | Add **unique** constraint suitable for Gmail dedupe: e.g. `UNIQUE (channel, gmail_connection_id, external_message_id)` **partial** `WHERE external_message_id IS NOT NULL AND channel = 'email'` (exact DDL to match Postgres version and naming conventions). | **R4** Must align with Twilio/other channels using `external_message_id` — partial index scoped to email avoids SMS collisions. **R5** Migration fails if duplicates remain — depends on M2 + dedupe. |
| **M4** | Optional expression index on JSON path **only if** column backfill deferred — prefer column + M3 over long-term JSON indexes. | **R6** Expression indexes harder to maintain; product chose column path. |

### B. Edge Functions

| ID | Task | Risk |
|----|------|------|
| **E1** | Refactor `gmail-sync-now` to extract **`syncLabel(gmailLabelId, options)`** (or equivalent): list messages with `labelIds` = `INBOX` then `SENT`, shared time window (`q` / `last_synced_at`), shared cap `MAX_MESSAGES_LISTED_PER_SYNC`. | **R7** Doubling label lists may approach cap faster — tune cap or merge ID lists if needed. |
| **E2** | **INBOX path**: Keep current behaviour: expand thread, `ingestGmailMessage` with direction from **From** vs mailbox (not forced inbound). When creating/updating conversations, set **`external_thread_id`** to Gmail `threadId` if NULL. | **R8** Regression if thread expansion order changes — keep ordering/skip logic equivalent. |
| **E3** | **SENT path**: For each listed SENT message: **dedupe** (prefer `external_message_id` / DB lookup by Gmail id + `gmail_connection_id`); resolve **conversation** by `inbox_conversations.external_thread_id = gmailThreadId` (scoped by user/org/connection); **insert** outbound row; **skip + warn** if no conversation (orphan). Do **not** create new conversations from SENT-only in v1 (per spec / product). | **R9** Orphans silently lose mail until product adds “create conversation” — acceptable per current decision. **R10** If M1 not deployed first, match rate is zero. |
| **E4** | Set **`external_message_id`** on every new `inbox_messages` insert from sync to raw Gmail message id (same as `meta.gmail.messageId`). | **R11** Aligns with M3; insert fails if duplicate — should be caught by pre-check. |
| **E5** | Update **`gmail-send-reply`**, **`gmail-send-first-message`**, and any other Gmail function inserting `inbox_messages` to set **`external_message_id`** (and ensure new conversations get **`external_thread_id`** on insert/update). | **R12** Missed function → unique constraint violation on next sync duplicate. |
| **E6** | Replace in-memory “recent 1000” duplicate scan in sync with **targeted query** by `gmail_connection_id` + `external_message_id` (or message id) where possible post-M3. | **R13** Performance improvement; optional follow-up if risky in one PR. |

### C. Frontend / types (optional in same release)

| ID | Task | Risk |
|----|------|------|
| **F1** | Regenerate or extend **`database.types.ts`** if schema comments/indexes only — usually no change if no new columns. | Low |
| **F2** | If sync response adds fields (`synced_inbox`, `synced_sent`), update `inboxGmail.api.ts` types — **optional**. | **R14** API contract drift if UI asserts shape |

### D. Verification

| ID | Task | Risk |
|----|------|------|
| **V1** | Staging: run M1–M3, then deploy functions; send reply in Gmail web; sync; assert outbound row and no duplicate. | **R15** Staging data must resemble prod (Gmail + OAuth). |

---

## Agent context

Updated via `.specify/scripts/powershell/update-agent-context.ps1 -AgentType cursor-agent` after this plan is filled (re-run if plan changes).
