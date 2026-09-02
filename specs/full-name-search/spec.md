# Feature Specification: Full-Name Search Across Inbox and People Surfaces

**Feature Branch**: `feature/full-name-search`
**Created**: 2026-09-02
**Status**: Draft
**Input**: User description: "Full-name search across the inbox and people surfaces — inbox search never joins `people` so customer names return nothing (C1, RPC + wiring); four client-side surfaces test first/last name independently so 'First Last' matches nowhere (C2)."
**Source of truth**: `docs/ux/inbox.md` (read-only audit at staging `1ab595a`, sections B1–B7). Where this spec, `docs/backlog.md`, or any older spec folder disagrees with that audit, the audit wins. Line numbers cited below are accurate at `1ab595a` and WILL drift with any edit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inbox search finds customers by name (Priority: P1)

Arin types a customer's name into the inbox search box and the customer's conversation thread appears. Today `fetchConversations` (`src/modules/inbox/api/inboxConversations.api.ts:16-66`) searches only `primary_handle`, `subject`, and `last_message_preview` — it never joins `people`, so a name matches only if it happens to appear in one of those columns. Arin-visible failure: "Noella Lindsey" → nothing; "Noella" → her thread (only because the name appears in a conversation column).

**Why this priority**: This is the reported, customer-facing defect. The inbox is the primary daily surface; staff know customers by name, not by email handle.

**Independent Test**: On staging, search the inbox for a linked customer's full name ("First Last") whose name does not appear in any conversation subject/preview. The thread appears. Name the specific record checked at verify time.

**Acceptance Scenarios**:

1. **Given** a conversation linked to a person (`person_id` set), **When** Arin searches the person's full name ("First Last"), **Then** the conversation appears in results.
2. **Given** the same conversation, **When** Arin searches a partial name ("Noella", "Lind"), **Then** it appears (case-insensitive substring).
3. **Given** an unlinked conversation (`person_id IS NULL`) whose handle/subject/preview matches the term, **When** Arin searches, **Then** it still appears — the `people` join MUST be a LEFT join; unlinked rows must not vanish from search (regression guard).
4. **Given** an active search term combined with a filter that can co-occur with search (status default `open`, channel, unread-only, unlinked-only), **When** both apply, **Then** results honour both — filter semantics identical to today.
5. **Given** a search term containing commas or parentheses (e.g. `Lindsey, Noella`), **When** Arin searches, **Then** results are correct and no request fails — today the raw term is interpolated into PostgREST `.or()` grammar (`inboxConversations.api.ts:54`) and such characters corrupt the filter (F-027). Passing the term as an RPC parameter closes this class as a side effect of this feature — it is not a separate feature.
6. **Given** search results are displayed, **When** Arin marks a conversation read/unread, **Then** the optimistic cache update works — the mark-read path does cache surgery on the cached row arrays across all `conversations.*` queries (`updateConversationUnreadCountInCache`, `useInboxConversations.ts:53-97`); the search path MUST return the identical row shape or this breaks silently.

---

### User Story 2 - "First Last" matches on the four client-side people surfaces (Priority: P2)

Four surfaces filter the org people list client-side, testing `first_name` and `last_name` as independent substrings — a two-word "First Last" query matches nowhere. Each must also match the joined full name. Sites (audit B5, all CONFIRMED):

- `src/modules/inbox/components/PeopleSidebar.tsx:29-39`
- `src/modules/inbox/components/LinkConversationModal.tsx:60-70`
- `src/modules/customers/pages/CustomersPage.tsx:57-68`
- `src/shared/components/UniversalSearch.tsx:42-51` (⌘K; note: CommandItem `value` at :128 already contains the joined name, but rows are pre-filtered by :42-51, so the defect stands)

**Why this priority**: Same symptom as P1 but a different mechanism (client-side filter, not DB query) and lower traffic than the inbox. No RPC, no DB change — pure predicate fix. **Lands as a separate commit from C1.**

**Independent Test**: On each of the four surfaces, type a known person's "First Last". The person appears. Single-word queries and email/phone queries behave exactly as today.

**Acceptance Scenarios**:

1. **Given** any of the four surfaces, **When** the query is "First Last", **Then** the person matches (case-insensitive, joined full name).
2. **Given** the same surfaces, **When** the query is a single word or an email/phone fragment, **Then** behaviour is unchanged from today.
3. **Given** a person with a null/empty first or last name, **When** any query runs, **Then** the predicate does not throw and matches on whatever name components exist.

---

### User Story 3 - Search does not refetch on every keystroke (Priority: P3)

There is no debounce anywhere in the search chain: input onChange → `setSearchQuery` → `baseFilters` memo → new query key → fetch per keystroke, and the fetch is the full unpaginated open set (SM: 1005 rows). Add a debounce at the `UnifiedInboxPage` baseFilters level (`searchQuery` state at `:96`, `baseFilters` memo at `:243-249`).

**Why this priority**: Load/latency hygiene that becomes more visible once search actually joins `people`; the defect itself (P1) is fixable without it, so it ranks below correctness.

**Independent Test**: Type an N-character query while watching the network tab: a small bounded number of conversation fetches fires (≈1 after typing pauses), not N. Typing remains immediately responsive in the input.

**Acceptance Scenarios**:

1. **Given** Arin types a multi-character query quickly, **When** typing pauses, **Then** one fetch fires with the final term; intermediate keystrokes do not each trigger a fetch.
2. **Given** the debounce, **When** Arin types, **Then** the input value updates instantly (debounce applies to the query value feeding `baseFilters`, not to the controlled input).
3. **Given** the debounce sits at the page state/memo level, **Then** no JSX in `CustomerThreadList:161-257` or `InboxConversationList:195-309` changes — that territory belongs to the shell cycle (audit B7 de-confliction).

---

### Edge Cases

- **Unlinked conversation + name-only term**: returns nothing for that row (no person to match) — correct; it still matches on handle/subject/preview per US1-scenario 3.
- **Whitespace**: leading/trailing whitespace in the term is trimmed before matching; an empty/whitespace-only term means "no search" and follows today's non-search path unchanged.
- **Name-component nulls**: people rows with null `first_name` or `last_name` must still match on the non-null component (both DB-side and client-side predicates).
- **Multiple internal spaces / middle names**: full-name matching is defined as case-insensitive substring over the single-space-joined "first_name last_name". A query with doubled spaces or a middle name not stored in either column will not match — accepted behaviour, not a defect.
- **Preview truncation (pre-existing, unchanged)**: every writer truncates `last_message_preview` to 120 chars at write time (audit B1); a term appearing only beyond that window never matched before and still won't. Out of scope.
- **Search term matching thousands of rows** (e.g. single letter): still bounded by the unpaginated full-set reality (SM: 1005 open) — no worse than today's no-term fetch. Pagination is explicitly out of scope (backlog).
- **Mark-read during active search**: covered by US1-scenario 6 (identical row shape).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Inbox conversation search MUST match the linked person's name (full "First Last" and partial, case-insensitive) in addition to today's `primary_handle` / `subject` / `last_message_preview` matching.
- **FR-002**: Name matching in the inbox is delivered by a new database RPC `search_inbox_conversations(p_organization_id, p_q)`:
  - `SECURITY INVOKER`; `set search_path = ''`.
  - `returns setof public.inbox_conversations` — viable per audit B2: it is a TABLE (not a view) with RLS enabled and four policies all gated on `user_is_member_of_org(organization_id)`; under invoker mode those policies apply inside the function. No `security_invoker` view concern exists here.
  - LEFT join `public.people` on `person_id` (never inner — see FR-005).
  - `revoke` from `public`, `grant execute` to `authenticated`.
  - Open question for /plan (Flag 4): `p_organization_id` is a pure filter under invoker RLS — a wrong org id yields an empty list, not an error. Whether the RPC should assert membership and raise is unresolved; debuggability, not security.
- **FR-003**: The swap MUST stay internal to `fetchConversations`. `ConversationFilters` (the exported type and every caller's usage) is untouched. **Ruled 2026-09-02: design (b).** The two designs flagged were:
  - (a) the RPC honours every `ConversationFilters` param, and `fetchConversations` always calls it; or
  - (b) `fetchConversations` branches — RPC only when a search term is present, today's PostgREST query otherwise.
  Under either design, every filter that can co-occur with a search term (status — default `'open'`, channel, unread_only, unlinked_only, and the org guard) MUST behave identically to today on the search path.
- **FR-004**: The RPC/search path MUST return rows shape-identical to today's `fetchConversations` result (all 21 `inbox_conversations` columns, same names/types). Rationale: mark-read/unread cache surgery (`useInboxConversations.ts:53-97`) and realtime/poll invalidation operate on the cached arrays; a shape change breaks them silently.
- **FR-005**: Unlinked conversations (`person_id IS NULL`) MUST still match on handle/subject/preview after the join — left-join semantics are a hard regression guard, not an implementation detail.
- **FR-006**: The search path MUST preserve today's sort: `last_message_at DESC NULLS LAST, created_at DESC` (`inboxConversations.api.ts:58-60`).
- **FR-007**: The search term MUST reach the database as a bound RPC parameter, never interpolated into PostgREST `.or()` grammar. This closes F-027 (commas/parens corrupting the filter) as a resolved side effect of C1 — record it as such, not as a separate feature.
- **FR-008**: A debounce MUST be added at the `UnifiedInboxPage` baseFilters level (`:96`, `:243-249`) so keystrokes do not each trigger a full-set refetch. The controlled input stays immediate; only the value feeding `baseFilters` (and hence the query key) is debounced. Default interval 300 ms (see Assumptions). No other UI file changes.
- **FR-009**: The four client-side surfaces (US2 list) MUST additionally match the case-insensitive joined full name. No RPC, no DB change, no shared-predicate refactor required by this spec. Separate commit from C1.
- **FR-010**: Migration discipline: the RPC lands via the Supabase Dashboard SQL editor, statement by statement — never a CLI database push. The tracked migration file MUST hold exactly the definition that is applied (F-026 is the standing example of a tracked RPC file that no longer matches the live definition — a replay hazard). The migration is committed and pushed to the remote before Dashboard apply.
- **FR-011**: Precedent RPC (`supabase/migrations/20260423112000_get_customer_messages_rpc.sql`) — copy ONLY its `search_path` pin and its `revoke public` / `grant authenticated` pair. Do NOT copy its `SECURITY DEFINER` mode or its trust of a caller-supplied `p_organization_id` with no membership check. Note: that tracked file is itself stale — the live definition is gated, hardened from the SearsMelvin repo (F-026); it is a pattern warning in both directions.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Blast radius)**: `fetchConversations` has exactly one caller, `useConversationsList` (`useInboxConversations.ts:100-112`), which has six call sites in five consumers (audit B4): `UnifiedInboxPage:278` (channel-filtered) and `:281` (baseFilters); `useCustomerThreads.ts:85` (baseFilters); `CustomerConversationView.tsx:139` (`{status:'open', person_id}`) and `:144` (`{status:'open', unlinked_only, channel, primary_handle_exact}`); `ConversationView.tsx:83` (`{status:'open', person_id}`). Several depend on non-search filters (`person_id`, `unlinked_only`, `channel`, `primary_handle_exact`). ALL six must keep working unchanged.
- **AC-002 (RLS as boundary)**: Authorization is enforced by `inbox_conversations` RLS under the invoker-mode RPC; the `p_organization_id` parameter is a filter, not the security boundary. UI checks are not security.
- **AC-003 (Scope walls)**:
  - No pagination work — the unpaginated 1005-row fetch is backlog.
  - No shell or top-bar JSX — the shell cycle owns `CustomerThreadList:161-257` and `InboxConversationList:195-309`. This cycle's only UI touch is `UnifiedInboxPage:96` and `:243-249`.
  - `?view=flat` is exempt — its list is untouched (it shares `fetchConversations`, so it inherits name matching for free, but no flat-view-specific work is in scope).
  - No `pg_trgm` / index work — the extension is available but NOT installed; unnecessary at 373 people / 1,544 conversations (audit B6). Plain ILIKE join is acceptable at these volumes.
  - Nothing touches `specs/inbox-sidebar-multi-tabs/` (the repo tsc baseline lives there).
- **AC-004 (Module boundaries)**: C1 changes live in `src/modules/inbox/` (api layer) plus the one migration file; C2 touches only the four named files.

### Key Entities

- **`inbox_conversations`**: TABLE (catalog-verified `relkind='r'`), RLS enabled, four policies all `user_is_member_of_org(organization_id)`. 21 columns; `person_id` uuid NULLABLE (the unlinked-conversation guard); `organization_id` NOT NULL. The RPC's return type and the cache-surgery row shape.
- **`people`**: the joined entity; `first_name` / `last_name` are the name source for both C1 (DB join) and C2 (client predicate). Org-guarded list feeding all four C2 surfaces: `fetchCustomers` (`useCustomers.ts:35-38`).
- **`search_inbox_conversations(p_organization_id uuid, p_q text)`**: new RPC per FR-002.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Searching the inbox for a linked customer's full name ("First Last") whose name appears in no conversation column returns their thread — the "Noella Lindsey" case goes from 0 results to the correct thread. Verified on staging against a named record.
- **SC-002**: All six `useConversationsList` call sites behave identically for non-search usage — zero behaviour change when no term is entered.
- **SC-003**: Unlinked conversations remain findable by handle/subject/preview with a search term active (left-join regression guard holds).
- **SC-004**: A search term containing `,` `(` `)` returns correct results with no failed request (F-027 closed).
- **SC-005**: Typing a query fires ≈1 conversations fetch after the pause, not one per keystroke (observed in the network tab on staging).
- **SC-006**: Mark-read/unread optimistic updates work while a search is active (row shape unchanged).
- **SC-007**: "First Last" queries match on all four client-side surfaces; single-word/email/phone queries unchanged.
- **SC-008**: The applied RPC definition and the tracked migration file are byte-identical at commit time (F-026 non-recurrence).

## Assumptions

- "Full name" = case-insensitive substring match over `first_name || ' ' || last_name` (single-space join, null-safe). Middle names/aliases not stored in those columns are out of scope.
- Debounce interval defaults to **300 ms** — not specified in the request; ruled at approval if a different value is wanted.
- ILIKE with a leading wildcard over the join is acceptable at current volumes (Churchill 204 + SM 169 people; 539 + 1,005 open conversations, live 2026-09-02); no index support exists for it and none is added.
- Giorgi applies the migration by hand in the Dashboard SQL editor and runs all gates; CC proposes diffs only.
- C1 and C2 are separate commits; C2 has no DB component.
- The flat view (`?view=flat`) inherits C1's name matching through the shared fetch path with no flat-specific work; this is acceptable fallout, not scope creep.

## Flags for ruling *(tensions & open decisions — do not resolve silently)*

1. **Spec file location** — **RULED 2026-09-02: moved** to `specs/full-name-search/spec.md` per CLAUDE.md; stale-path grep clean (0 references outside this file); folder-vs-flat defect proposed as an addition to the existing create-new-feature.sh backlog line.
2. **FR-003 design choice** — **RULED 2026-09-02: branch (b)** — RPC only when a search term is present; the non-search path stays byte-identical for all six call sites, and the RPC surface stays minimal (org, term, plus only the filters that co-occur with search: status/channel/unread_only/unlinked_only).
3. **No scope-vs-audit contradictions found**: every checkable claim in the request (row counts, table-not-view, RLS policy shape, blast-radius list, B5 site list, B7 de-confliction) matches `docs/ux/inbox.md`. The other items in this section are tooling/design tensions, not audit conflicts.
4. **RPC membership assertion — OPEN, for /plan**: FR-002 leaves `p_organization_id` as a pure filter under invoker RLS, so a wrong org id yields an empty list rather than an error. Question: should the RPC assert `user_is_member_of_org(p_organization_id)` and raise? This is debuggability, not security (RLS already blocks cross-org reads either way). Not resolved here; /plan carries it and Giorgi rules.
