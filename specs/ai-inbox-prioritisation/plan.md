# Implementation Plan: AI Inbox Prioritisation v1

**Branch**: `feature/ai-inbox-prioritisation` | **Date**: 2026-09-10 | **Spec**: `specs/ai-inbox-prioritisation/spec.md` (e9628ec)
**Input**: Spec Rulings R-001..R-011, Architectural Constraints AC-001..AC-008, and the Phase 0 read-only pass recorded below. Rulings are settled and not re-argued here. Approved by Giorgi 2026-09-10 with five amendments (folded in and marked **[A1]..[A5]**).

## Summary

Four nullable rank fields on `inbox_conversations` (R-001), written only by a new edge function `inbox-ai-rank` that mirrors `inbox-ai-thread-summary`'s auth/model/JSON-mode pattern via a new shared conversation-text module (FR-018), triggered by a fire-and-forget client sweep on inbox mount (R-002) and operator backfill (FR-021). Surfaced through a net-new PageShell-owned floating AI button host (context registration, v1: inbox only) opening a "Needs attention" slide-over that reads the already-fetched conversation cache (R-004/R-006). Five commits: C1 migration → C2 edge function + shared module → C3 host + panel + sweep hook (new files + PageShell) → C3a the single permitted `UnifiedInboxPage.tsx` edit → C4 docs.

## Technical Context

**Language/Version**: TypeScript (React 18 + Vite/SWC front end; Deno edge functions)
**Primary Dependencies**: TanStack Query, Radix/shadcn (`src/shared/components/ui/`), supabase-js, OpenAI chat completions (gpt-4o-mini, JSON mode — R-009)
**Storage**: Postgres `inbox_conversations` (4 additive nullable columns; RLS unchanged per AC-003)
**Testing**: vitest (existing suites must stay green); `DENO_NO_PACKAGE_JSON=1 deno check` for the new function (tsc never sees Deno files)
**Target Platform**: staging.unifynow.digital → production (single Supabase project)
**Project Type**: web app + edge functions
**Performance Goals**: sweep ≤ K=15 AI calls per inbox mount, 0 when nothing stale (SC-006); backfill ≈762 rankable SM conversations at k=50 ≈ 16 loops
**Constraints**: 6-hour cap (SC-009, cut list applies); no edits to Arin-adjacent files beyond the single C3a commit (AC-008); no ingestion edits (AC-005); drift discipline (AC-004/FR-023)
**Scale/Scope**: SM ≈762 rankable open conversations (2026-09-10 count; re-count day-of), Churchill 1

## Constitution Check

- **Dual router**: PASS — no routing change; registration is a page-level context call (AC-001).
- **Module boundaries**: PASS with one noted import — host + context in `src/shared/`; panel + hook in `src/modules/inbox/`; host renders an opaque registered node and never imports a feature module (AC-002). `NeedsAttentionPanel` imports `useCustomersList` from `@/modules/customers` — existing precedent `useCustomerThreads.ts:3`; logged in Complexity Tracking.
- **Supabase + RLS**: PASS — rank fields covered by existing org policies; all writes via service role in the edge function; no client writes (AC-003).
- **Secrets**: PASS — OpenAI key + `INTERNAL_FUNCTION_KEY` only in the edge function env; no new client-side secrets.
- **Additive-first**: PASS — additive nullable columns, no defaults, no view/RPC changes (AC-004). Rollback: columns can sit unused; `alter table … drop column` is the (deferred) reverse.

## Phase 0 findings (read-only, 2026-09-10; predictions stated before each read)

**Q1 — deep link.** `?conversation=<id>` exists but is mount-time-only: flat-view seed in the `useState` initializer (`UnifiedInboxPage.tsx:123-130`, reads `window.location` directly — TDZ comment :127), customers-view one-shot ref `customersDeepLinkConversationIdRef` (:135-137) consumed inside the auto-select effect (:602-610, resolves conversation id → customer row). Invokers are all cross-route navigations: `PipelineJobCard.tsx:51`, `ExitedJobsList.tsx:69`, and the `/enquiry-triage` redirect (`router.tsx:42-48`). No reactive re-seed exists, so a panel click from a mounted inbox needs an in-page handler → **C3a required**; it reuses the existing ref + `setCustomersSelection(null)` path rather than adding a parallel mechanism.

**Q2 — PageShell.** Root `src/components/layout/PageShell.tsx:151` (`flex h-screen overflow-hidden`); content region :284-290 hosts `<Outlet/>`; the host mounts as a `position:fixed` sibling of `UniversalSearch` (:293). Dialog and Sheet overlays/content are `z-50` (`src/shared/components/ui/dialog.tsx:22,:39`; `sheet.tsx:22,:32`) → button at `z-40` satisfies FR "hidden or behind any open dialog". No registration precedent; nearest patterns are the route-keyed maps (:29-65) and the PageShell-owned `AdminProvider` (:150/:295) — a new `AiPanelProvider` follows that provider pattern.

**Q3 — thread-summary anatomy (what C2 copies).** Auth :230-256 (user JWT via anon-client `getUser`, else `x-internal-key` vs `INTERNAL_FUNCTION_KEY`; env :217-221). **Org resolution is from the data, not the caller** (:301-321, :350-368, :410-431; null-guard :466-471) — there is no membership check, so the ranker cannot mirror auth verbatim and satisfy FR-009: it **adds** an `organization_members` lookup (deviation recorded; finding logged in C4). Message assembly :291-460 (+ sort normalize :462-464, `sortMessagesLikeUnifiedTimeline` :59-74); `stripHtml` :15-23 applied per email line :536; transcript line format :534-539; window `MAX_MESSAGES_IN_PROMPT=60` :13 applied :529-532; OpenAI JSON call :545-561 (gpt-4o-mini :552, `response_format: json_object` :557, max_tokens 300 :558, temp 0.3 :559); fingerprint cache :473-474/:515-520 (not needed by the ranker — staleness keys on `last_message_at`, R-003).

**Q4 — query keys.** One hook feeds both views: `useConversationsList` (`useInboxConversations.ts:100-112`), key `['inbox','conversations','list', orgId, filters]` (factory `inboxKeys` :22-51), org from `useOrganization()` (:104). Customers view derives client-side (`useCustomerThreads.ts:85`; zero own queries); page entries: channel-filtered (:312) and `baseFilters` (:315) where `baseFilters={status:'open'}(+unread_only/+unlinked_only/+search)` (:273-283). Sweep invalidation target: prefix `inboxKeys.conversations.all` (precedent `useWhatsAppConnection.ts:30`). Panel + bubble read `useConversationsList({status:'open'})` — same hook and endpoint, cache-shared with the page's entry whenever no unread/search filter is active; while such a filter is active it is a distinct cache entry of the same query fn (no new endpoint — judged within R-006's intent; noted, not silent). Person names via `useCustomersList()` mapped by `person_id`, fallback `primary_handle` (`useCustomerThreads.ts:3,:86,:171`). `fetchConversations` is `select('*')` (`inboxConversations.api.ts:20-23`) so the new columns flow into every list fetch automatically (R-001 confirmed).

**Supporting checks.** `supabase/config.toml` has no `inbox-ai-thread-summary` entry (7 `verify_jwt=false` functions, all webhooks/OAuth) → `inbox-ai-rank` deploys **plain** (no flag, no config.toml entry) and every internal-key call must also carry `Authorization: Bearer <anon key>` to pass the gateway, exactly like the summary function. tsc baseline holds **0 items** in `PageShell.tsx` and `UnifiedInboxPage.tsx`. `schema_migrations` appears in no tracked migration — recording it is a manual apply step. Baseline per-file grep before each edit remains mandatory (line-shift trap).

## Project Structure

### Documentation (this feature)

```text
specs/ai-inbox-prioritisation/
├── spec.md              # committed e9628ec
└── plan.md              # this file
```

(research.md folded into Phase 0 above; tasks.md via /tasks if Giorgi wants it — the commit list below is already task-shaped.)

### Source Code (repository root)

```text
supabase/
├── migrations/20260910120000_add_inbox_ai_rank_fields.sql   # C1 (new)
└── functions/
    ├── _shared/conversationText.ts                          # C2 (new)
    └── inbox-ai-rank/index.ts                               # C2 (new)

src/
├── shared/
│   ├── context/AiPanelContext.tsx                           # C3 (new)
│   └── components/AiPanelHost.tsx                           # C3 (new)
├── components/layout/PageShell.tsx                          # C3 (edit: provider wrap + host mount, ~3 lines)
└── modules/inbox/
    ├── components/NeedsAttentionPanel.tsx                   # C3 (new)
    ├── hooks/useInboxAiSweep.ts                             # C3 (new)
    ├── types/inbox.types.ts                                 # C3 (edit: 4 optional fields on InboxConversation :24-49)
    └── pages/UnifiedInboxPage.tsx                           # C3a ONLY (registration + sweep call + select handler)
```

**Structure Decision**: host/context in `src/shared/` (AC-002, page-agnostic); panel and sweep in `src/modules/inbox/`; no route-table change.

## Commits (one concern each; Giorgi gates + commits by explicit path; handoff.md per commit policy)

### C1 — migration `20260910120000_add_inbox_ai_rank_fields.sql`

Tracked file first; **committed and pushed before Dashboard apply** (git rule). Header comment block records: purpose + spec ref; portal reader note — `../SearsMelvin/functions/api/partner-orders.js` reads `inbox_conversations` by **explicit column list** (Q2 follow-up), so additive columns are invisible to it and no other portal surface touches these fields; views-over-table check — pg_depend showed **zero views** over `inbox_conversations` on 2026-09-10, re-run at apply and record the result in the comment block (counts/IDs only, no PII, no real UUIDs).

Statements (lowercase, applied one at a time in the Dashboard SQL editor — auto-commit, no BEGIN/COMMIT):

```sql
alter table public.inbox_conversations add column ai_priority integer;
alter table public.inbox_conversations add column ai_reason text;
alter table public.inbox_conversations add column ai_category text;
alter table public.inbox_conversations add column ai_scored_at timestamptz;
alter table public.inbox_conversations add constraint inbox_conversations_ai_priority_range
  check (ai_priority is null or (ai_priority >= 0 and ai_priority <= 100));
alter table public.inbox_conversations add constraint inbox_conversations_ai_category_check
  check (ai_category is null or ai_category in ('sales', 'support', 'admin', 'other'));
```

No reason-length CHECK: truncation to 120 is the function's store-time job (edge case rule); a CHECK would turn a straggler over-length write into a hard failure instead. No index (≤ ~1.1k open rows per org). No RLS/grant changes — existing table policies cover the columns (AC-003).

**Apply steps + read-backs (Giorgi, in order):**
1. Views check (before): expect 0 rows —
   ```sql
   select distinct dep.relname
   from pg_rewrite r
   join pg_class dep on r.ev_class = dep.oid
   join pg_depend d on d.objid = r.oid
   join pg_class src on d.refobjid = src.oid
   where src.relname = 'inbox_conversations' and dep.relkind = 'v' and dep.relname <> src.relname;
   ```
2. The six statements, one at a time.
3. Columns read-back: `select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='inbox_conversations' and column_name like 'ai\_%' escape '\';` → **4 rows, all nullable**.
4. Constraints read-back: `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.inbox_conversations'::regclass and conname like '%ai_%';` → **2 rows**.
5. No row rewritten: `select count(*) from public.inbox_conversations where ai_priority is not null or ai_reason is not null or ai_category is not null or ai_scored_at is not null;` → **0**.
6. Record the version (verify the table's column shape first with `select * from supabase_migrations.schema_migrations limit 1;`, then insert version `20260910120000` accordingly) and read back: `select version from supabase_migrations.schema_migrations where version = '20260910120000';` → **1 row** (F-033 lesson).

tsc/lint delta: none (SQL only). Files: the migration + handoff.

### C2 — edge function + shared module

**`supabase/functions/_shared/conversationText.ts`** (new) — the FR-018 shared step, extracted as copies from the summary function (which is NOT modified this cycle; its migration onto this module is a backlog line in C4):
- `MsgRow` (:33-43), `stripHtml` (:15-23), `sortMessagesLikeUnifiedTimeline` (:59-74);
- `fetchConversationMessages(supabase, conversationId)` — the explicit-column select + `created_at` asc order (:325-331);
- `buildTaggedTranscript(messages, { maxMessages, charCap })` — newest-N window (:529-532 pattern), line format identical to :534-539 (`[channel] [direction] <ts> from=<h> to=<h>: <text>`, email bodies HTML-stripped), then drop oldest whole lines until ≤ charCap.

**`supabase/functions/inbox-ai-rank/index.ts`** (new). Constants at top: `K_DEFAULT = 15`, `K_MAX = 50`, `REFRESH_DAYS = 7`, `MAX_MESSAGES_IN_PROMPT = 20` (FR-005), `TRANSCRIPT_CHAR_CAP = 8000` (the FR-005 number this plan sets: ≈2k tokens; newest lines kept). K and the window are function-local — changeable without a migration (spec assumption).

1. **CORS/method/env** — copy of summary :3-7, :202-228 (env: `OPENAI_API_KEY`, `INTERNAL_FUNCTION_KEY`, standard Supabase trio).
2. **Auth** — copy of :230-256 (JWT via anon client, else internal key). **Then org resolution from the caller (FR-009; deviation from the summary function, which has no membership check — Phase 0 Q3):**
   - JWT caller: `organization_members` rows for `authUserId` (service role); body `organization_id` must be one of the memberships (else 403). **[A1]** The client always sends it (see C3's sweep hook); if absent and the caller has exactly one membership, use it; absent + several → 400 (backstop only — the client path never hits it).
   - Internal-key caller: body `organization_id` required (operator-supplied under the trusted key).
3. **Selection** (service role, implements FR-002 server-side):
   ```ts
   supabase.from('inbox_conversations')
     .select('id, last_message_at, ai_scored_at, order_id, enquiry_stage, channel, inbox_messages!inner(id)')
     .eq('organization_id', org).eq('status', 'open')
     .not('inbox_messages.body_text', 'is', null)
     .neq('inbox_messages.body_text', '')
     .limit(1, { foreignTable: 'inbox_messages' })
   ```
   The `!inner` embed keeps only conversations with ≥1 non-empty body (embed filters AND); `limit 1` bounds payload. **F-025-class check before writing this code (CC, read-only via supabase-ro): exactly one FK path `inbox_messages → inbox_conversations` in `pg_constraint`; if a second path exists, add the FK-name hint.** Ordering in function code over the returned set (≈762 rows, id + timestamps only): tier 1 `ai_scored_at is null`, tier 2 `last_message_at > ai_scored_at`, tier 3 `ai_scored_at < now − REFRESH_DAYS` (FR-003 order); tiers 1–2 by `last_message_at` desc, tier 3 by `ai_scored_at` asc; take `min(body.k ?? K_DEFAULT, K_MAX)`. **[A3]** All ordering/staleness comparisons go through `Date.parse`, never string compare. Empty selection → `200 {selected:0, written:0, failed:0}`, **no AI call** (FR-004; the backfill stop condition).
4. **Claim** (per selected row, optimistic): `update … set ai_scored_at = <sweepIso> where id = <id> and organization_id = <org> and ai_scored_at <is null | = <prev>>` with `.select('id')` — 0 rows returned = another sweep claimed it, drop from batch (acceptance scenario 4). Keep `id → prevScoredAt` for restore. **[A3]** The `eq('ai_scored_at', prev)` filters (claim AND restore) use the `ai_scored_at` string **exactly as PostgREST returned it** — never re-formatted through `Date` — so the equality match cannot miss on serialization differences.
5. **Score loop** (sequential; ≤50): fetch messages via the shared module → `buildTaggedTranscript` → prompt (below) → OpenAI call copied from :545-561 — **[A2] `max_tokens: 300`, matching the summary function** (a tighter cap risks truncated JSON → parse failure → restore → tier-1 re-selection on every load) → validate: JSON-parse; `Number.isInteger(priority) && 0 ≤ priority ≤ 100` else fail; `reason` non-empty string else fail, truncate to 120 at store time; `category` in set else `'other'` (FR-007, edge-case rules).
   - Success: `update {ai_priority, ai_reason, ai_category, ai_scored_at: sweepIso}` `.eq(id).eq(organization_id, org)`.
   - Failure (parse/range/API error): restore `update {ai_scored_at: prevScoredAt}` `.eq(id).eq(organization_id, org).eq('ai_scored_at', sweepIso)` (only if still ours) + `console.error` with ids only. Never write partial fields (FR-004).
   - **[A2] Accepted v1 residual**: a permanently failing row (e.g. content the model always answers invalidly for) is restored to never-scored and re-selected as tier 1 on every inbox load — one wasted AI call per load per such row. Accepted for v1; if one shows up in logs, the manual fix is a Dashboard write of its rank fields (Giorgi).
6. **Response**: `200 {selected, written, failed}`.

**Prompt** (FR-006 — facts supplied, no formula; exact wording tunable at approval):
- system: *"You rank inbox conversations for a memorial masonry business so staff know which to handle first. Score how urgently a staff member needs to act now, 0–100 (higher = act sooner; around 70+ means the customer is waiting on us or there is a deadline; low means waiting on the customer or nothing to do). Base the score on the messages, weighted to the most recent. Output only valid JSON: {"priority": <integer 0-100>, "reason": <one sentence for the staff member naming what needs doing, max 120 characters>, "category": <"sales"|"support"|"admin"|"other">}. Do not invent details."*
- user: facts block — last message direction + age, `enquiry_stage` (or "none"), linked order yes/no (`order_id` non-null), channel — followed by the tagged transcript.

**Gate/verify**: `DENO_NO_PACKAGE_JSON=1 deno check inbox-ai-rank/index.ts` from `supabase/functions/` → **0 errors** (new-function baseline; `conversationText.ts` checked transitively). tsc/lint delta: none (Deno files invisible to tsc). Deploy **after commit+push**: `supabase functions deploy inbox-ai-rank` — **no flag** (gateway JWT verification stays on, matching the summary function; internal-key callers pass the gateway with `Bearer <anon key>`; not added to config.toml).

### C3 — PageShell host + inbox panel + sweep hook (new files + PageShell + types only; no UnifiedInboxPage edit)

- **`src/shared/context/AiPanelContext.tsx`** (new): `AiPanelProvider`; `useRegisterAiPanel({ title, count, panel })` registers via `useEffect` (never during render; memoized value; cleanup unregisters on unmount) and returns `{ close }`; `useAiPanelRegistration()` for the host. One registration at a time (route-scoped by construction — only mounted pages register; FR-010).
- **`src/shared/components/AiPanelHost.tsx`** (new): reads the context; **renders `null` when no registration** — no placeholder, no disabled button (FR-012, F-031 class). Otherwise: `fixed bottom-6 right-6 z-40` button (below the `z-50` dialog/sheet layer — Q2), count bubble hidden at 0 (FR-013); opens a Sheet (right slide-over per R-011; full-width below `md` via the sheet's responsive classes) titled from the registration; host owns open state (closed on load, not persisted), Escape/backdrop close come from the Sheet primitive (FR-011). Design tokens only (gardens vars), no ad-hoc colours.
- **`src/components/layout/PageShell.tsx`** (edit, ~3 lines): wrap the shell in `AiPanelProvider` (beside `AdminProvider`, :150/:295) and mount `<AiPanelHost />` as a sibling of `UniversalSearch` (:293). Nothing visible on unregistered routes (AC-006).
- **`src/modules/inbox/components/NeedsAttentionPanel.tsx`** (new): `useConversationsList({ status: 'open' })` → keep `ai_priority != null` → sort priority desc, `last_message_at` desc → slice 25 (FR-014). Item: name via `useCustomersList()` map ?? `primary_handle` (precedent `useCustomerThreads.ts:3,:86,:171`); **panel-local badge** High ≥70 / Medium 40–69 / none (NOT `ScoreBadge` — AC-002, RFM semantics); reason; last-message age. Numeric priority never renders. Empty state "Nothing scored yet" (FR-017). `onSelect(conversationId)` prop.
- **`src/modules/inbox/hooks/useInboxAiSweep.ts`** (new): once-per-mount ref-guarded effect (StrictMode double-fire guarded) → **[A1]** `supabase.functions.invoke('inbox-ai-rank', { body: { organization_id: organizationId } })` with `organizationId` from `useOrganization()` — the same source `useConversationsList` uses (`useInboxConversations.ts:104`) — so a staff user with two memberships never 400s into a silently dead sweep; effect no-ops while `organizationId` is null. Fire-and-forget; on `written ≥ 1` → `queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all })`; errors to console only (FR-019).
- **`src/modules/inbox/types/inbox.types.ts`** (edit): `ai_priority?: number | null; ai_reason?: string | null; ai_category?: 'sales' | 'support' | 'admin' | 'other' | null; ai_scored_at?: string | null;` on `InboxConversation` (:24-49).

C3 alone changes nothing visible anywhere (no page registers yet) — that is the verification.

### C3a — the single permitted `UnifiedInboxPage.tsx` commit (AC-008; Q1 says it is required)

Three additions, all outside the pill/filter arms; `reviewer` confirms no pill/filter/list-file lines in the diff:
1. `useInboxAiSweep()` — the mount sweep (FR-019).
2. Registration: `useRegisterAiPanel({ title: 'Needs attention', count: <open rows with ai_priority ≥ 70 from useConversationsList({status:'open'})>, panel: <NeedsAttentionPanel onSelect={handleAiPanelSelect} /> })` (FR-013).
3. `handleAiPanelSelect(id)`: customers view → `customersDeepLinkConversationIdRef.current = id; setCustomersSelection(null);` (the :602-610 effect resolves the row — the existing deep-link machinery, not a parallel one); flat view → `setSelectedConversationId(id)`; then `close()`. Off-list targets fall back exactly like the existing `?conversation=` deep link (spec edge case: "behaves like the existing deep link").

### C4 — docs

- `docs/handoff.md`: T-block with per-commit record + tripwire ledger (see Ledger below).
- `docs/findings.md`: **[A5]** numbered F-0xx (next free number) — `inbox-ai-thread-summary` lacks a caller-membership check: auth passes on any valid JWT of any org's user (:230-256) while the org is resolved from the looked-up row (:301-321, :350-368, :410-431), service-role reads behind it — so any authenticated user of any org can request any conversation's summary text. F-009 class but stronger (actual cross-org read, not RLS-only). Found Phase 0 Q3, 2026-09-10.
- `docs/backlog.md`: (a) migrate `inbox-ai-thread-summary` onto `_shared/conversationText.ts` (FR-018); (b) **[A5]** the F-0xx membership fix — **small fix, engineering-health reserve** (add the same `organization_members` check the ranker ships with; not deferred indefinitely).
- Arin notes (for the demo heads-up, AC-006): AI button is new on the inbox only; web-channel conversations with text are included (spec assumption); "doesn't have to be perfect" v1.
- `spec.md`: Status → Planned; annotate the deep-link assumption with the mount-time caveat and the FR-009 membership deviation.

## tsc baseline (current 54; item-diff by key; per-file baseline grep before every edit — line-shift trap)

| Commit | Files tsc sees | Expected | Shifts |
|---|---|---|---|
| C1 | none (SQL) | 54/54, 0 new | none |
| C2 | none (Deno; `deno check` = 0 errors on the new function) | 54/54, 0 new | none |
| C3 | new files (must add 0) + PageShell.tsx + inbox.types.ts | 54/54, 0 new | **none predicted** — PageShell.tsx holds 0 baseline items (verified); inbox.types.ts predicted 0 (grep the baseline for it before the edit) |
| C3a | UnifiedInboxPage.tsx | 54/54, 0 new | none — 0 baseline items in the file (verified) |
| C4 | none | 54/54 | none |

Lint: ≤ 8 err / 19 warn throughout (new files clean). SC-008's "≤10" is the spec's slack; the working target stays the current 8/19.

## Backfill (Giorgi — AC-007; after C2 deploy + C1 apply; values from CLAUDE.local.md / secrets at paste time, never committed)

**[A4] Step 1 — first-scoring proof, k=5, one call, on SM deliberately** (the E2E org may have no text conversations, so the C2 smoke proves auth only; this is the first scoring evidence):

```bash
PROJECT_REF=<project-ref> ; ANON_KEY=<anon key> ; INTERNAL_KEY=<INTERNAL_FUNCTION_KEY> ; SM_ORG=<SM organization_id>
curl -s -X POST "https://$PROJECT_REF.supabase.co/functions/v1/inbox-ai-rank" \
  -H "Authorization: Bearer $ANON_KEY" -H "x-internal-key: $INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"organization_id\":\"$SM_ORG\",\"k\":5}"
```

Stop. Run the SC-002 spot-read on exactly those five rows (query below with `limit 5`), read each reason against its thread. Only when all five reasons are about their own threads, continue.

**Step 2 — loop at k=50:**

```bash
while :; do
  resp=$(curl -s -X POST "https://$PROJECT_REF.supabase.co/functions/v1/inbox-ai-rank" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "x-internal-key: $INTERNAL_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"organization_id\":\"$SM_ORG\",\"k\":50}")
  echo "$(date -u +%H:%M:%S) $resp"
  sel=$(jq -r '.selected' <<<"$resp") ; wr=$(jq -r '.written' <<<"$resp")
  [ "$sel" = "0" ] && { echo "DONE — nothing left to score"; break; }
  [ "$wr" = "0" ] && { echo "STOP — selected>0 but written=0; investigate before continuing"; break; }
  sleep 2
done
```

**Stop condition**: `selected == 0` (FR-004 empty selection; nothing stale during backfill, so this terminates). Guard: `written == 0` with `selected > 0` aborts the loop — prevents an infinite claim/restore cycle on permanently failing rows. Expected ≈16 iterations (762 / 50). The `Bearer $ANON_KEY` header is required — the function deploys with gateway JWT verification on (Phase 0 check); the anon key passes the gateway and the internal key authorizes inside the function.

**Read-back (SC-001; Dashboard or supabase-ro; `<SM>` from CLAUDE.local.md):**

```sql
select
  count(*) filter (where has_text and ai_priority is not null)  as rankable_scored,
  count(*) filter (where has_text)                              as rankable,
  count(*) filter (where not has_text and (ai_priority is not null or ai_reason is not null
                   or ai_category is not null or ai_scored_at is not null)) as non_rankable_touched
from (
  select c.*, exists (
    select 1 from inbox_messages m
    where m.conversation_id = c.id and m.body_text is not null and m.body_text <> ''
  ) as has_text
  from inbox_conversations c
  where c.organization_id = '<SM>' and c.status = 'open'
) t;
-- expect rankable_scored = rankable (≈762; re-count day-of), non_rankable_touched = 0
select id, ai_priority, ai_category, ai_reason, ai_scored_at
from inbox_conversations
where organization_id = '<SM>' and ai_priority is not null
order by ai_scored_at asc
limit 5;   -- [A4] step-1 spot-read: the five rows just scored
-- full SC-002 spot-check after the loop: order by ai_priority desc, last_message_at desc limit 10;
-- record the conversation ids (ids only) in the handoff
```

## Verification checklist per commit (Giorgi runs anything authenticated; name the record checked)

- **C1**: the six apply read-backs above (columns 4 / constraints 2 / views 0 / touched rows 0 / schema_migrations 1 row). Named record: n/a (catalog only).
- **C2** (after deploy): (a) unauthorized: curl with no JWT/key → 401. (b) internal-key + E2E org id → 200 with a well-formed `{selected, written, failed}` — **[A4] this proves auth/shape only** (the E2E org may have zero text conversations; first scoring proof is the k=5 SM pass above). (c) claim race not directly testable by hand — code-reviewed instead (conditional-update claim, scenario 4; raw-string equality per [A3]). CC pre-check (read-only, supabase-ro): FK count `inbox_messages → inbox_conversations` = 1 for the `!inner` embed.
- **C3**: browser on staging — Finance, Pipeline, Orders, Customers show **no** AI button (SC-004, name the four routes checked); no layout change on any route; gate green.
- **C3a**: browser on staging, SM org, after backfill — button + High-count bubble matches `select count(*) … ai_priority >= 70 and status='open'` (run the query, name both numbers); panel lists ≤25 in priority order, reasons render, no numbers (SC-003); click an item in customers view → row selected, panel closes — **name the conversation id**; repeat in `?view=flat`; open a dialog (e.g. New Conversation) → button behind/hidden (z-40 < z-50); Escape and backdrop close the panel; Churchill org → button, no bubble, "Nothing scored yet" (SC-007); narrow viewport → panel full-width, button clear of the composer.
- **Freshness (SC-005/SC-006, E2E org only)**: note a conversation's `ai_scored_at`; send an inbound test message (E2E fixtures); reload inbox as the E2E user → sweep re-scores it (newer `ai_scored_at`, reason reflects the new message — name the id); reload again with nothing changed → response `{selected:0}` in the network tab, no scored_at moves. (If the E2E org has no text conversation, create one via the disposable-fixture pattern first.)
- **C4**: docs render; reviewer pass over the full branch diff vs the rules.

## Hours vs the 6-hour cap (SC-009)

| Item | Est |
|---|---|
| C1 migration + apply/read-backs | 0.5 |
| C2 shared module + edge function + deno baseline + deploy | 2.0 |
| C3 host + panel + sweep hook | 1.25 |
| C3a UnifiedInboxPage edit + browser verify | 0.5 |
| Backfill + live verify (Giorgi) | 0.5 |
| C4 docs + spec annotations (plan already written) | 1.0 |
| **Total** | **5.75 ≤ 6** |

Overrun order (spec cut list): last-message age on items → bubble count → category prompt field.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Cross-feature import `@/modules/customers` → `useCustomersList` in `NeedsAttentionPanel` | Person names for panel items | Denormalized name column doesn't exist on the row; a new fetch/endpoint violates FR-016; precedent already stands at `useCustomerThreads.ts:3` |
| Panel/bubble use a `{status:'open'}` cache entry that is separate while unread/search filters are active | Panel must ignore list filters (spec edge case) | Passing the page's filtered `allConversations` would shrink the panel under active search — violates the filter-independence edge case; same queryFn, no new endpoint |
| Ranker adds an `organization_members` check the summary function lacks | FR-009 requires caller-resolved org; the mirror target has no membership check (Phase 0 Q3) | Verbatim mirroring would let any org's authenticated user sweep any org — reproduces the flaw now logged as F-0xx |

## Tripwire ledger (planning session, 2026-09-10)

Carried in: 3/3 (structural only, Giorgi's framing). Phase 0 produced **4 structural misses, 0 live-data/execution misses**:
1. Predicted a reactive `useSearchParams` deep link; actual mount-time one-shot seed (`UnifiedInboxPage.tsx:123-137`) — flipped C3a to required.
2. Placed the ui primitives at `src/components/ui/` (CLAUDE.md's path); actual `src/shared/components/ui/`.
3. Predicted a caller-membership check in the summary function's auth; none exists — org resolved from data (drives the FR-009 deviation and the new F-0xx finding).
4. Predicted a denormalized name column on the conversation row; actual: names come from `useCustomersList()`.

**Giorgi ruling (2026-09-10, logged per protocol): override granted for the plan write; the 4 misses are ruled findings-about-shape, not execution errors; the tripwire count RESETS at C1** for the implementation sessions.
