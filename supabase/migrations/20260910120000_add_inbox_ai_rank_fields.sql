-- migration: additive AI rank fields on inbox_conversations
-- spec: specs/ai-inbox-prioritisation/spec.md FR-023 (plan C1); AC-003, AC-004
-- purpose:
--   - four nullable columns holding the ranker output for one conversation:
--     ai_priority (0-100), ai_reason (one sentence, truncated to 120 at store
--     time by the edge function), ai_category (stored, not rendered in v1),
--     ai_scored_at (doubles as the optimistic claim marker for concurrent sweeps)
--   - two null-tolerant CHECK constraints: priority range, category vocabulary
-- additive guarantees (FR-023):
--   - nullable, no DEFAULT -> no table rewrite, no existing column altered
--   - no index (open rows per org are ~1.1k; selection is org + status scoped)
--   - no reason-length CHECK: over-length is the function's store-time truncation
--     job; a CHECK would turn a straggler write into a hard failure instead
--   - no RLS or grant changes: the existing inbox_conversations policies already
--     cover new columns (AC-003); writes come from the edge function under the
--     service role, never from the client
-- portal reader note:
--   ../SearsMelvin/functions/api/partner-orders.js reads inbox_conversations by
--   an EXPLICIT column list, so additive columns are invisible to it, and no
--   other portal surface touches these fields. The portal was checked, not
--   assumed ("unused by Mason" != unused).
-- views-over-table check:
--   pg_rewrite/pg_depend showed ZERO views over public.inbox_conversations on
--   2026-09-10 (planning read). Re-run immediately before apply and record here:
--   VIEWS OVER inbox_conversations AT APPLY: 0  (fill in at apply; if
--   non-zero, list view names only — views are frozen at creation and will
--   not expose the new columns; only matters if one of them is expected to.
-- apply: Dashboard SQL editor, one statement at a time (auto-commit, no
--   BEGIN/COMMIT). Read-backs recorded here at apply — counts only, no UUIDs,
--   no names, no emails:
--   1. columns like 'ai\_%' on the table   -> EXPECT 4, all nullable | actual: 4
--   2. constraints like '%ai_%'            -> EXPECT 2               | actual: 2
--   3. rows with any ai_* field non-null   -> EXPECT 0               | actual: 0
--   4. schema_migrations version row       -> EXPECT 1               | actual: 1

alter table public.inbox_conversations add column ai_priority integer;

alter table public.inbox_conversations add column ai_reason text;

alter table public.inbox_conversations add column ai_category text;

alter table public.inbox_conversations add column ai_scored_at timestamptz;

alter table public.inbox_conversations add constraint inbox_conversations_ai_priority_range
  check (ai_priority is null or (ai_priority >= 0 and ai_priority <= 100));

alter table public.inbox_conversations add constraint inbox_conversations_ai_category_check
  check (ai_category is null or ai_category in ('sales', 'support', 'admin', 'other'));
