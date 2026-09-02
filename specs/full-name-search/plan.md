# Implementation Plan: Full-Name Search Across Inbox and People Surfaces

**Branch**: `feature/full-name-search` | **Date**: 2026-09-02 | **Spec**: `specs/full-name-search/spec.md`
**Input**: Feature spec + plan-time directives from Giorgi (2026-09-02): FR-003 ruled branch (b) with the RPC scoped from CODE call paths, not the type; Flag 4 carried unresolved with evidence; debounce ruled 300 ms; template-shaped per `.specify/templates/plan-template.md` (merged in at `dbb5615`), script-free per precedent (`create-new-feature.sh` defect on backlog).

## Summary

Inbox search never joins `people`, so customer names return nothing (Arin-visible). Fix in four concerns: **C1** a `SECURITY INVOKER` RPC `search_inbox_conversations` + a branch inside `fetchConversations` that fires it only when a search term is present (non-search path byte-identical); **C2** the four client-side people surfaces additionally match the joined full name; **C3** a 300 ms debounce on the value feeding `baseFilters`; **C4** docs. No pagination, no pg_trgm, no shell/JSX territory (AC-003 walls).

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vite (SWC); SQL (Postgres 17.6) for the RPC
**Primary Dependencies**: existing only — TanStack Query, Supabase client (`createClient<any>` — no generated-type friction on the `rpc()` call). **No new dependency, no new module.**
**Storage**: one new RPC over existing `inbox_conversations` (TABLE, RLS on, four `user_is_member_of_org` policies — audit B2) LEFT-joined to `people`. **No table/column/policy/view change.**
**Testing**: no DOM test env — browser verify with named records (Playwright MCP or local dev against the single Supabase project; staging serves the branch only after merge) + Giorgi's gates.
**Target Platform**: desktop web, `/dashboard/inbox` + `/dashboard/customers` + ⌘K
**Project Type**: web frontend + one migration file
**Performance Goals**: ≈1 conversations fetch per typing pause (SC-005); search path no worse than today's full-set fetch
**Constraints (immovable)**: non-search path byte-identical (FR-003b); row shape identical — 21 columns (FR-004, cache surgery `useInboxConversations.ts:53-97`); LEFT join (FR-005); sort preserved (FR-006); term as bound parameter (FR-007, closes F-027); tsc item-diff re-anchored same-commit, 0 new; nothing touches `specs/inbox-sidebar-multi-tabs/`
**Scale/Scope**: live 2026-09-02 — people: Churchill 204 + SM 169; open conversations: 539 + 1,005. Plain ILIKE join acceptable; `pg_trgm` available but NOT installed, stays uninstalled (audit B6).

**Spec citation defect (surprise #4, post-override) — CORRECTED pre-/tasks 2026-09-02**: spec US2 carried wrong directory prefixes (`src/pages/`, `src/components/`) for two surfaces; audit B5 was bare-filename (under-specified, not wrong). Spec fixed, B5 disambiguated to full paths. All four paths and all four predicate line ranges content-verified 2026-09-02.

## Constitution Check

- **Dual router constraint**: PASS — no route added/moved/renamed.
- **Module boundaries**: PASS with note — C1/C3 stay in `src/modules/inbox/`; C2 additionally touches `src/modules/customers/pages/CustomersPage.tsx` and `src/shared/components/UniversalSearch.tsx`, each edit file-local, no cross-module import added, no shared predicate introduced (FR-009 explicitly requires none).
- **Supabase + RLS**: PASS — RPC is `SECURITY INVOKER`; the table's RLS policies are the boundary (AC-002); `p_organization_id` is a filter, not security. `user_is_member_of_org` already uses `(select auth.uid())`. `specs/rls-isolation-findings.md` read (mandated): no view is touched, so the `security_invoker`-reset trap does not arise.
- **Secrets**: N/A — no edge function, no keys.
- **Additive-first**: PASS — additive RPC; the non-search path is untouched by construction; rollback = drop function + revert branch commit.

## Project Structure

### Documentation (this feature)

```text
specs/full-name-search/
├── spec.md            # written 2026-09-02, rulings applied (FR-003b; Flag 1 moved)
├── plan.md            # this file
└── tasks.md           # Phase 2 — /tasks output (NOT created by /plan)
```

**Structure Decision**: research/data-model/contracts are folded into this plan — the structural audit (`docs/ux/inbox.md` B1–B7) already is the research artifact, the only data shape is the existing 21-column `inbox_conversations` row (FR-004 forbids changing it), and the single contract is the RPC signature below. Separate files would restate them.

### Source Code (files per commit; line refs pinned at `1ab595a`, re-verify on drift)

```text
C1a supabase/migrations/<timestamp>_search_inbox_conversations_rpc.sql   # new; committed+pushed BEFORE Dashboard apply (FR-010)
C1b src/modules/inbox/api/inboxConversations.api.ts                      # branch inside fetchConversations (:16-66; search block :52-55 replaced by RPC call on the search path)
C2  src/modules/inbox/components/PeopleSidebar.tsx                       # :29-39
    src/modules/inbox/components/LinkConversationModal.tsx               # :60-70
    src/modules/customers/pages/CustomersPage.tsx                        # :57-68
    src/shared/components/UniversalSearch.tsx                            # :42-51
C3  src/modules/inbox/pages/UnifiedInboxPage.tsx                         # :96 state + :243-249 memo; nothing else, no JSX (B7 wall)
C4  docs/{findings,backlog,handoff}.md                                   # F-027 closed-by note; backlog strike (spec/B5 path corrections landed pre-/tasks)
```

## 1. FR-003 — RPC scope from the code (ruled: branch (b))

Which filters can co-occur with a search term — established from the six `useConversationsList` call sites (UI fact, not `ConversationFilters` type fact):

| Call site | Filters passed | Search possible? |
|---|---|---|
| `UnifiedInboxPage:278` via `conversationsListFilters` (`:271-274`) | baseFilters + `channel` | **YES** |
| `UnifiedInboxPage:281` | baseFilters | **YES** |
| `useCustomerThreads.ts:85` | baseFilters (prop from page) | **YES** |
| `CustomerConversationView.tsx:139` | literal `{status:'open', person_id}` — no `search` key; `enabled`-gated by link-modal state | **NO** |
| `CustomerConversationView.tsx:144` | literal `{status:'open', unlinked_only, channel, primary_handle_exact}` — no `search` key; `enabled`-gated | **NO** |
| `ConversationView.tsx:83` | literal `{status:'open', person_id}` — no `search` key | **NO** |

`baseFilters` (`UnifiedInboxPage:243-249`) = `{ status:'open' }` + `unread_only` | `unlinked_only` (mutually exclusive via `listFilter`) + `search`. Both views (customers and `?view=flat`) share it; `channel` joins via `:271-274` / `?channel`.

**Therefore**: search co-occurs only with **org, status, channel, unread_only, unlinked_only**. `person_id` and `primary_handle_exact` never carry a search term — excluded from the RPC.

**Signature (approved 2026-09-02)**:

```
search_inbox_conversations(
  p_organization_id uuid,
  p_q               text,
  p_status          text    default 'open',
  p_channel         text    default null,
  p_unread_only     boolean default false,
  p_unlinked_only   boolean default false
) returns setof public.inbox_conversations
```

`security invoker`; `set search_path = ''`; `revoke all from public` + `grant execute to authenticated`; `language sql stable` if Flag 4 resolves silent, `plpgsql` if raise (see §2). Body: LEFT join `public.people` on `person_id`; match = today's three whole-term ILIKEs OR the tokenised name arm (amended 2026-09-03: p_q split on non-alphanumerics, every token a case-insensitive substring of `concat_ws(' ', first_name, last_name)`; zero tokens → name arm false via `bool_and … is true`); filters mirror `fetchConversations:26-45` semantics; sort `last_message_at desc nulls last, created_at desc` (FR-006). Term reaches the DB only as `p_q` (FR-007). Precedent copy-list per FR-011: search_path pin + revoke/grant pair ONLY.

**Status default ownership (ruled to be stated)**: `fetchConversations` owns it — today's `:26-31` fallback (`filters?.status ?? 'open'`) is applied at the api layer, and on the search branch the same expression is passed as `p_status` explicitly. The RPC's `default 'open'` is defensive only and unreachable from Mason code; the page-level `status:'open'` at `baseFilters:244` is a third writer of the same value but the api layer remains the single authoritative owner on both paths. No layer relies on the RPC default.

**Branch semantics**: term present after trim (same test as today's `:52`) → `supabase.rpc('search_inbox_conversations', …)`, cast to `InboxConversation[]` exactly as today (row shape identical, FR-004); term absent/whitespace → today's PostgREST builder, **byte-identical**, all six call sites unchanged (SC-002). `ConversationFilters` untouched.

## 2. Flag 4 — membership assert vs silent filter (OPEN — Giorgi rules at C1a diff)

Both patterns have in-repo precedent, all live-verified via `pg_proc` 2026-09-02:

**Option A — assert + raise**. Precedent: `get_inquiries_pipeline` (tracked `20260506124500:45-48` = live): `if not public.user_is_member_of_org(p_organization_id) then raise exception 'not authorized' using errcode = '42501'`.
- For: a wrong-org call surfaces as a visible query error instead of an empty inbox — the silent-empty class is exactly what makes drift/wiring bugs expensive (F-026 debugging experience); useQuery error state is observable.
- Against: forces `language plpgsql` (a `language sql` body cannot raise), losing the `sql stable` shape of the `get_customer_messages` precedent; introduces a new failure mode on the search path — an org-switch race between context and in-flight query would flash an error where today it yields an empty list. Zero security gain: RLS already blocks cross-org reads either way (AC-002).

**Option B — silent filter (FR-002 as written)**. Precedent: live `get_customer_messages` — WHERE-clause `user_is_member_of_org(p_organization_id)` gate, silent empty (the SearsMelvin 2026-08-09 hardening; note that gate is load-bearing there only because that function is SECURITY DEFINER — under this INVOKER RPC even a WHERE-gate is security-redundant).
- For: behaviour identical to today's PostgREST path (wrong org under RLS = empty list today too — no new failure mode); keeps `language sql stable`.
- Against: a bug passing the wrong org id is indistinguishable from "no results".

Third variant on record, not proposed: silent empty `return` (`get_organization_members_with_identity:19`) — plpgsql cost without the loud-failure benefit.

Helper fact either way: `user_is_member_of_org` is `stable` SECURITY DEFINER over `organization_members` on `(select auth.uid())` (tracked `20260411140600:3-16` = live) — callable from an invoker RPC without RLS recursion.

## 3. Debounce — RULED 2026-09-02: 300 ms

In-repo input-debounce precedent is 250 ms (`GooglePlacesAutocompleteInput.tsx:79`); this fetch is the heaviest in the app (SM 1,005 rows, unpaginated), so slightly above it. The other in-repo constants (200 ms `UnifiedInboxPage:53`, 400 ms `useGhlInboxRealtime:7`) are realtime-invalidation coalescing, not input debounces — not comparators.

Implementation (C3): module const `SEARCH_DEBOUNCE_MS = 300` beside `REALTIME_DEBOUNCE_MS` (`:53`); a `debouncedSearchQuery` state driven by a cleanup-safe `setTimeout` effect on `searchQuery`; `baseFilters` (`:243-249`) consumes the debounced value; the controlled input keeps `searchQuery` (US3 scenario 2). Clearing the input also waits 300 ms before the full-list refetch — accepted, not special-cased (minimal surface). No JSX in `CustomerThreadList:161-257` / `InboxConversationList:195-309` (B7 de-confliction).

## FR → Commit map (each FR exactly once)

| Commit | Concern | FRs |
|---|---|---|
| **C1a** | Migration file only | FR-002, FR-010, FR-011 |
| **C1b** | `fetchConversations` branch + RPC wiring | FR-001, FR-003, FR-004, FR-005, FR-006, FR-007 |
| **C2** | Four client-side full-name predicates | FR-009 |
| **C3** | baseFilters debounce | FR-008 |
| **C4** | Docs only (spec/B5 path corrections landed pre-/tasks, 56533af) | — |

**C1a/C1b split rationale**: FR-010 requires the migration committed and pushed *before* Dashboard apply, while browser-verify-before-commit requires the RPC live *before* the wiring commits — one C1 commit would be circular. T8's "C1" is this pair; the spec's "C1 and C2 are separate commits" holds.

**Sequencing**: C1a commit+push → Giorgi applies in Dashboard SQL editor statement-by-statement → read-back `pg_proc.prosrc` vs the tracked file (SC-008, byte-identical; F-026 non-recurrence) → C1b written, verified, committed → C2 → C3 → C4.

## Per-commit tsc baseline plan (grep-verified against `specs/inbox-sidebar-multi-tabs/tsc-baseline-items.txt`, 54 items)

| Commit | Expected to LINE-SHIFT (re-anchor same commit) | Expected stable |
|---|---|---|
| C1a | none (SQL only) | all 54 |
| C1b | `inboxConversations.api.ts(94,5)` — the edit region `:16-66` sits above it; shift = net added lines, grep the baseline for the file before `tsc` | `useInboxConversations.ts(158,34),(193,34)` — file untouched |
| C2 | none — all four files hold 0 baseline items | all 54 |
| C3 | none — `UnifiedInboxPage.tsx` holds 0 items | all 54 |
| C4 | none (docs) | all 54 |

0 new items any commit. Lint: 0 delta (8 err/19 warn holds). No edge function → no `deno check` leg. Item-diff with `--strip-trailing-cr`; never by count.

## Per-commit gate + verify predictions

| Commit | Browser check (named record at verify time) |
|---|---|
| C1a | n/a code-side; Dashboard read-back = SC-008 |
| C1b | SC-001 "Noella Lindsey" full-name → her thread; SC-002 no-term list identical; SC-003 unlinked row still matches by handle with a term active; SC-004 `Lindsey, Noella` correct + no failed request; SC-006 mark-read during active search |
| C2 | SC-007 "First Last" on all four surfaces; single-word/email/phone unchanged; a null-name-component person doesn't throw |
| C3 | SC-005 network tab: ≈1 conversations fetch after a typing pause, input responsive |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| C2 edits span three module territories (inbox, customers, shared) | The four broken predicates live where the audit found them; each fix is file-local | A shared name-match predicate is new shared surface the spec explicitly does not require (FR-009); relocating files is out of scope |
| C1 split into two commits | Push-before-apply (FR-010) and verify-before-commit are circular in one commit | Committing unverified wiring, or applying an uncommitted RPC, each violates a standing rule |

## Phase 2 approach (for /tasks)

One task group per commit C1a→C4 in order, each carrying: its FRs, files with pinned line refs, the Flag-4 ruling due at C1a diff approval, expected baseline shifts from the table above, its SC verify targets, and Giorgi's gate/commit/apply checkpoints (CC applies only after diff approval; Giorgi runs gates, git, and all Dashboard statements).

## Progress Tracking

- [x] Research folded: `docs/ux/inbox.md` B1–B7 + this plan's call-site evidence table (live-data checks 2026-09-02: pg_proc for all three precedent functions; volumes from audit B6)
- [x] Constitution check: no violations; two justified complexity rows
- [x] FR-003: signature settled from code; status-default ownership stated (api layer)
- [ ] **Flag 4: OPEN — ruled at C1a diff approval**
- [x] Debounce: ruled 300 ms
- No NEEDS CLARIFICATION markers. Line refs pinned at `1ab595a` (+ `dbb5615` merge, docs/template only) — re-verify on drift before each apply.
